// Inbound SMS webhook (Twilio TwiML + RingCentral JSON friendly).
// Two behaviours:
//   1. If the person has a check-in reminder waiting, the text is saved as a
//      note on that meal and the reminder is closed out.
//   2. Otherwise the text is treated as a new food/drink entry: analyze-food
//      estimates the label, carbs and portion, and a food_log row is inserted.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Numbers are stored inconsistently (E.164, bare 10 digits, 1-prefixed), so we
// look the person up by every reasonable spelling of the number that texted us.
function phoneVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return Array.from(new Set([raw, digits, ten, `1${ten}`, `+1${ten}`, `+${digits}`]));
}

function classify(text: string): "food" | "drink" | "medication" {
  const t = text.toLowerCase();
  if (/\b(pill|dose|metformin|insulin|med|medication|took my)\b/.test(t)) return "medication";
  if (/\b(coffee|tea|soda|juice|water|smoothie|milk|beer|wine|drank|drink|latte|shake)\b/.test(t)) {
    return "drink";
  }
  return "food";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Twilio posts form-encoded; RingCentral webhooks post JSON.
    let from = "";
    let body = "";
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
    }

    if (!from || !body) {
      return reply("Sorry, I didn't catch that. Text me what you ate or drank and I'll log it.");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Matches on the engagement record first, then on the sign-in phone number.
    const { data: userId, error: lookupError } = await supabase.rpc("find_user_by_phone", {
      _variants: phoneVariants(from),
    });
    if (lookupError) console.error("phone lookup failed", lookupError);


    if (!userId) {
      return reply("Welcome! Please sign up in the Calm Glucose app so I can save your entries.");
    }

    // Simple opt-out courtesy.
    if (/^(stop|unsubscribe|cancel)$/i.test(body)) {
      await supabase
        .from("notification_prefs")
        .upsert({ user_id: userId, post_meal_sms_enabled: false }, { onConflict: "user_id" });
      return reply("Okay — I won't text you check-ins anymore. You can turn them back on in the app.");
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

    if (reminder) {
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

      return reply(
        `Thank you — I added that to your ${reminder.meal_label} entry. 💚`,
      );
    }

    // 2. Otherwise treat the text as a new entry — held for confirmation.
    const type = classify(body);
    const draft = await analyzeEntry(supabase, body, type);

    const { error: draftError } = await supabase.from("sms_pending_logs").insert({
      user_id: userId,
      type,
      label: draft.label,
      carbs_grams: draft.carbs,
      portion_size: draft.portion,
      original_text: body,
      status: "pending",
    });

    if (draftError) {
      console.error("sms_pending_logs insert failed", draftError);
      return reply("I couldn't save that just now. Please try again in a moment.");
    }

    return reply(confirmPrompt(draft.label, draft.carbs, draft.portion));

  } catch (e) {
    console.error("sms-inbound error", e);
    return reply("Something went wrong on my end. Please try again in a moment.");
  }
});
