// Inbound SMS webhook (Twilio TwiML + RingCentral JSON friendly).
// Two behaviours:
//   1. If the person has a check-in reminder waiting, the text is saved as a
//      note on that meal and the reminder is closed out.
//   2. Otherwise the text is treated as a new food/drink entry: analyze-food
//      estimates the label, carbs and portion, and a food_log row is inserted.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSmsEvent, updateSmsEvent } from "../_shared/smsAudit.ts";
import { downloadPhoto, parsePhotos, photoReplyIntent, verifyTwilioSignature, type MealPhoto } from "./media.ts";
import {
  classify,
  confirmPrompt,
  interpretReply,
  phoneVariants,
  savedReplyText,
  sumCarbs,
} from "./logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function twiml(message: string) {
  const escaped = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

function reply(message: string) {
  return new Response(twiml(message), {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}


async function analyzeEntry(
  supabase: ReturnType<typeof createClient>,
  text: string,
  type: "food" | "drink" | "medication",
  photos: MealPhoto[] = [],
) {
  let label = text.slice(0, 60);
  let carbs: number | null = null;
  let portion: string | null = null;

  if (type !== "medication" || photos.length) {
    const aiResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-food`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({ text, images: photos, lang: "en" }),
    });

    if (aiResp.ok) {
      const j = await aiResp.json();
      if (photos.length && (!j.foodName || j.foodName.toLowerCase() === "unknown")) {
        throw new Error("I couldn't identify a meal in that photo. Please describe what you ate in words.");
      }
      label = j.foodName || label;
      carbs = j.carbsGrams ?? null;
      portion = j.portionSize ?? null;
    } else {
      if (photos.length) {
        const failure = await aiResp.json().catch(() => ({}));
        throw new Error(failure.error || "I couldn't analyze that photo. Please describe your meal in words.");
      }
      console.error(`analyze-food failed [${aiResp.status}]: ${await aiResp.text()}`);
    }
  }

  return { label, carbs, portion };
}

// Warm confirmation sent back after the entry is written to the journal.
async function savedReply(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  entry: { type: string; label: string; carbs_grams: number | null; portion_size: string | null },
) {
  if (entry.type === "medication") return savedReplyText(entry, 0);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: todays } = await supabase
    .from("food_logs")
    .select("carbs_grams")
    .eq("user_id", userId)
    .gte("logged_at", startOfDay.toISOString());

  return savedReplyText(entry, sumCarbs(todays as Array<{ carbs_grams: number | null }> | null));
}




// Records the inbound text's result and the reply we send back, then returns
// the TwiML response. Every path through the webhook goes through this so the
// audit log never has a gap.
async function respondAndLog(
  audit: { inboundId: string | null; userId: string | null; phone: string },
  message: string,
  detail: {
    purpose: string;
    outcome: string;
    status?: string;
    relatedTable?: string | null;
    relatedId?: string | null;
  },
) {
  await updateSmsEvent(audit.inboundId, {
    purpose: detail.purpose,
    outcome: detail.outcome,
    status: detail.status ?? "received",
    relatedTable: detail.relatedTable ?? null,
    relatedId: detail.relatedId ?? null,
  });
  await logSmsEvent({
    userId: audit.userId,
    direction: "outbound",
    phone: audit.phone,
    body: message,
    provider: "twilio",
    status: "sent",
    purpose: `reply: ${detail.purpose}`,
    relatedTable: detail.relatedTable ?? null,
    relatedId: detail.relatedId ?? null,
  });
  return reply(message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Twilio posts form-encoded; RingCentral webhooks post JSON.
    let from = "";
    let body = "";
    let attachments: Array<{ url: string; mimeType: string }> = [];
    let mediaError = "";
    let messageSid = "";
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const json = await req.json().catch(() => ({} as Record<string, unknown>));
      const msg = (json as any)?.body?.[0] ?? json;
      from = String(msg?.from?.phoneNumber ?? msg?.From ?? msg?.from ?? "");
      body = String(msg?.subject ?? msg?.text ?? msg?.Body ?? msg?.body ?? "").trim();
    } else {
      const form = await req.formData();
      from = (form.get("From") || "").toString();
      body = (form.get("Body") || "").toString().trim();
      messageSid = String(form.get("MessageSid") ?? "");
      if (String(form.get("NumMedia") ?? "0") !== "0") {
        const token = Deno.env.get("TWILIO_AUTH_TOKEN");
        const backendUrl = Deno.env.get("SUPABASE_URL");
        if (!token || !backendUrl || !await verifyTwilioSignature(req, form, token, `${backendUrl}/functions/v1/sms-inbound`)) {
          return new Response("Invalid webhook signature", { status: 403, headers: corsHeaders });
        }
        try { attachments = parsePhotos(form); }
        catch (error) { mediaError = error instanceof Error ? error.message : "Please describe your meal in words."; }
      }
    }

    if (!from || (!body && !attachments.length && !mediaError)) {
      await logSmsEvent({
        direction: "inbound",
        phone: from || "unknown",
        body,
        provider: contentType.includes("application/json") ? "ringcentral" : "twilio",
        status: "ignored",
        purpose: "unreadable message",
        outcome: "Could not read the sender or the message text",
      });
      return reply("Sorry, I didn't catch that. Text me what you ate or drank and I'll log it.");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Matches on the engagement record first, then on the sign-in phone number.
    const { data: userId, error: lookupError } = await supabase.rpc("find_user_by_phone", {
      _variants: phoneVariants(from),
    });
    if (lookupError) console.error("phone lookup failed", lookupError);

    // Log the inbound text immediately — even from an unknown number — so the
    // audit trail shows messages that arrived but couldn't be matched.
    const inboundId = await logSmsEvent({
      userId: (userId as string) ?? null,
      direction: "inbound",
      phone: from,
      body: body || "[Meal photo]",
      provider: contentType.includes("application/json") ? "ringcentral" : "twilio",
      status: "received",
      purpose: "incoming text",
      metadata: { matched_account: Boolean(userId), media_count: attachments.length, ...(messageSid ? { twilio_sid: messageSid } : {}) },
    });

    const audit = { inboundId, userId: (userId as string) ?? null, phone: from };

    if (!userId) {
      return await respondAndLog(
        audit,
        "Welcome! Please sign up in the Calm Glucose app so I can save your entries.",
        {
          purpose: "unknown sender",
          outcome: "No account matches this phone number",
          status: "unmatched",
        },
      );
    }

    const intent = photoReplyIntent(body, attachments.length > 0);

    // Simple opt-out courtesy.
    if (intent === "stop") {
      await supabase
        .from("notification_prefs")
        .upsert({ user_id: userId, post_meal_sms_enabled: false }, { onConflict: "user_id" });
      return await respondAndLog(
        audit,
        "Okay — I won't text you check-ins anymore. You can turn them back on in the app.",
        { purpose: "opt-out", outcome: "Check-in texts turned off" },
      );
    }

    let photos: MealPhoto[] = [];
    if (!mediaError && attachments.length) {
      try {
        const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const token = Deno.env.get("TWILIO_AUTH_TOKEN");
        if (!sid || !token) throw new Error("Photo access is unavailable. Please describe your meal in words.");
        for (const attachment of attachments) photos.push(await downloadPhoto(attachment, sid, token, messageSid));
      } catch (error) { mediaError = error instanceof Error ? error.message : "The photo could not be opened."; }
    }
    if (mediaError) return await respondAndLog(audit, mediaError, {
      purpose: "meal photo", outcome: "Photo not processed; no meal saved", status: "failed",
    });

    // 0. Waiting on a confirmation for something they just texted in?
    const sincePending = new Date(Date.now() - 6 * 3.6e6).toISOString();
    const { data: pending } = await supabase
      .from("sms_pending_logs")
      .select("id, type, label, carbs_grams, portion_size, original_text")
      .eq("user_id", userId)
      .eq("status", "pending")
      .gte("created_at", sincePending)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    async function nextDraftPrompt() {
      const { data: next } = await supabase.from("sms_pending_logs")
        .select("label, carbs_grams, portion_size")
        .eq("user_id", userId).eq("status", "pending")
        .gte("created_at", sincePending)
        .order("created_at", { ascending: true }).order("id", { ascending: true })
        .limit(1).maybeSingle();
      return next ? `\nNext meal waiting: ${confirmPrompt(next.label, next.carbs_grams, next.portion_size)}` : "";
    }

    if (pending && intent !== "new_entry" && intent !== "checkin") {
      if (intent === "confirm") {
        const { data: savedLog, error: insertError } = await supabase.from("food_logs").insert({
          user_id: userId,
          type: pending.type,
          label: pending.label,
          carbs_grams: pending.carbs_grams,
          portion_size: pending.portion_size,
          source: "sms",
          notes: pending.label === pending.original_text.slice(0, 60) ? null : pending.original_text,
        }).select("id").maybeSingle();
        if (insertError) {
          console.error("food_logs insert failed", insertError);
          return await respondAndLog(
            audit,
            "I couldn't save that just now. Please try again in a moment.",
            { purpose: "confirmation", outcome: `Save failed: ${insertError.message}`, status: "failed" },
          );
        }
        await supabase
          .from("sms_pending_logs")
          .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
          .eq("id", pending.id);
        return await respondAndLog(audit, (await savedReply(supabase, userId as string, pending)) + (await nextDraftPrompt()), {
          purpose: "confirmation",
          outcome: `Saved "${pending.label}" to the journal`,
          relatedTable: "food_logs",
          relatedId: (savedLog?.id as string) ?? null,
        });

      }

      if (intent === "discard") {
        await supabase.from("sms_pending_logs").update({ status: "discarded" }).eq("id", pending.id);
        return await respondAndLog(
          audit,
          "No problem — I didn't save it." + (await nextDraftPrompt()),
          { purpose: "confirmation", outcome: "Entry discarded" },
        );
      }

      // Only an explicit correction edits the oldest waiting meal.
      const correction = body.replace(/^(edit|correction|correct to|actually|instead|it was|make that|change to)\b[:\s]*/i, "").trim();
      if (!correction) return await respondAndLog(audit, "Text EDIT followed by the corrected meal details.", {
        purpose: "correction", outcome: "Correction details needed",
      });
      const type = photos.length ? "food" : classify(correction);
      let revised;
      try { revised = await analyzeEntry(supabase, correction, type, photos); }
      catch (error) { return await respondAndLog(audit, error instanceof Error ? error.message : "Please describe your meal in words.", {
        purpose: "meal photo", outcome: "Photo analysis failed; draft unchanged", status: "failed",
      }); }
      await supabase
        .from("sms_pending_logs")
        .update({
          type,
          label: revised.label,
          carbs_grams: revised.carbs,
          portion_size: revised.portion,
          original_text: correction,
        })
        .eq("id", pending.id);
      return await respondAndLog(
        audit,
        confirmPrompt(revised.label, revised.carbs, revised.portion),
        {
          purpose: "correction",
          outcome: `Draft updated to "${revised.label}" — waiting for confirmation`,
          relatedTable: "sms_pending_logs",
          relatedId: pending.id as string,
        },
      );
    }

    // 1. Is this a reply to a check-in we sent recently?

    const sinceCheckin = new Date(Date.now() - 12 * 3.6e6).toISOString();
    const { data: reminder } = await supabase
      .from("meal_reminders")
      .select("id, food_log_id, meal_label")
      .eq("user_id", userId)
      .eq("status", "pending")
      .not("sms_sent_at", "is", null)
      .gte("sms_sent_at", sinceCheckin)
      .order("sms_sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reminder && intent === "checkin") {
      const { data: log } = await supabase
        .from("food_logs")
        .select("notes")
        .eq("id", reminder.food_log_id)
        .maybeSingle();

      const stamped = `Check-in reply: ${body}`;
      const notes = log?.notes ? `${log.notes}\n${stamped}` : stamped;

      await supabase.from("food_logs").update({ notes }).eq("id", reminder.food_log_id);
      await supabase
        .from("meal_reminders")
        .update({ status: "responded", responded_at: new Date().toISOString() })
        .eq("id", reminder.id);

      return await respondAndLog(
        audit,
        `Thank you — I added that to your ${reminder.meal_label} entry. 💚`,
        {
          purpose: "check-in reply",
          outcome: `Added as a note on the ${reminder.meal_label} entry`,
          relatedTable: "food_logs",
          relatedId: reminder.food_log_id as string,
        },
      );
    }

    if (intent !== "new_entry") return await respondAndLog(audit,
      "There isn't a matching meal waiting. Text what you ate or drank to start a new entry.",
      { purpose: "unmatched reply", outcome: "No matching pending meal or check-in" });

    // 2. Separate meal texts always get their own draft, even during a check-in.
    const type = photos.length ? "food" : classify(body);
    let draft;
    try { draft = await analyzeEntry(supabase, body, type, photos); }
    catch (error) { return await respondAndLog(audit, error instanceof Error ? error.message : "Please describe your meal in words.", {
      purpose: "meal photo", outcome: "Photo analysis failed; no meal saved", status: "failed",
    }); }

    const { data: draftRow, error: draftError } = await supabase.from("sms_pending_logs").insert({
      user_id: userId,
      type,
      label: draft.label,
      carbs_grams: draft.carbs,
      portion_size: draft.portion,
      original_text: body || "Meal photo sent by text",
      status: "pending",
    }).select("id").maybeSingle();

    if (draftError) {
      console.error("sms_pending_logs insert failed", draftError);
      return await respondAndLog(
        audit,
        "I couldn't save that just now. Please try again in a moment.",
        { purpose: "new entry", outcome: `Draft failed: ${draftError.message}`, status: "failed" },
      );
    }

    return await respondAndLog(
      audit,
      pending
        ? `Added another meal: ${draft.label}. Nothing saved yet.\nFirst meal waiting: ${confirmPrompt(pending.label, pending.carbs_grams, pending.portion_size)}`
        : confirmPrompt(draft.label, draft.carbs, draft.portion),
      {
        purpose: photos.length ? "meal photo" : "new entry",
        outcome: `Read as "${draft.label}" — waiting for confirmation`,
        relatedTable: "sms_pending_logs",
        relatedId: (draftRow?.id as string) ?? null,
      },
    );

  } catch (e) {
    console.error("sms-inbound error", e);
    return reply("Something went wrong on my end. Please try again in a moment.");
  }
});
