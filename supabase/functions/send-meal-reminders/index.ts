// Cron-triggered: delivers post-meal check-in reminders.
// A reminder row is created by a database trigger whenever a food/drink entry
// is saved. This function decides *when* that check-in actually fires:
//   - "auto" (default): if the person has CGM readings after the meal, fire as
//     soon as a real glucose rise is detected; otherwise fall back to the timer.
//   - "spike": only fire on a detected rise.
//   - "time": always fire on the fixed delay.
// In-app delivery is handled by the client reading the same table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSms, type SmsProvider } from "../_shared/sms.ts";
import { generateNudge } from "../_shared/nudgePersona.ts";
import { DIGEST_HOUR, detectRises, mealCovers, planRiseTexts } from "../_shared/riseDetect.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// Minimum rise (mg/dL) above the pre-meal baseline that counts as a spike.
const RISE_THRESHOLD: Record<string, number> = { low: 60, medium: 45, high: 30 };
// Never fire a spike-based check-in sooner than this after the meal.
const MIN_MINUTES_AFTER_MEAL = 30;

// Quiet hours are stored as local hours, so compare against the person's tz.
function localHour(tz: string | null, now: Date): number {
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz || "America/Chicago",
        hour: "numeric",
        hour12: false,
      }).format(now),
    );
  } catch {
    return now.getUTCHours();
  }
}

function quietNow(startHour: number | null, endHour: number | null, hour: number) {
  if (startHour === null || endHour === null) return false;
  if (startHour === endHour) return false;
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}


interface SpikeCheck {
  hasCgm: boolean;
  spiked: boolean;
  rise: number | null;
  peak: number | null;
}

async function checkSpike(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  mealAt: Date,
  threshold: number,
): Promise<SpikeCheck> {
  const windowStart = new Date(mealAt.getTime() - 20 * 60000).toISOString();
  const windowEnd = new Date(mealAt.getTime() + 5 * 3.6e6).toISOString();

  const { data } = await supabase
    .from("cgm_readings")
    .select("ts, mg_dl")
    .eq("user_id", userId)
    .gte("ts", windowStart)
    .lte("ts", windowEnd)
    .order("ts", { ascending: true })
    .limit(200);

  const readings = (data ?? []) as { ts: string; mg_dl: number }[];
  if (readings.length === 0) return { hasCgm: false, spiked: false, rise: null, peak: null };

  const baselineWindowEnd = mealAt.getTime() + 10 * 60000;
  const baselineReadings = readings.filter((r) => new Date(r.ts).getTime() <= baselineWindowEnd);
  if (baselineReadings.length === 0) return { hasCgm: true, spiked: false, rise: null, peak: null };

  const baseline =
    baselineReadings.reduce((s, r) => s + Number(r.mg_dl), 0) / baselineReadings.length;

  const afterMeal = readings.filter(
    (r) => new Date(r.ts).getTime() >= mealAt.getTime() + MIN_MINUTES_AFTER_MEAL * 60000,
  );
  if (afterMeal.length === 0) return { hasCgm: true, spiked: false, rise: null, peak: null };

  const peak = Math.max(...afterMeal.map((r) => Number(r.mg_dl)));
  const rise = Math.round(peak - baseline);

  return { hasCgm: true, spiked: rise >= threshold, rise, peak: Math.round(peak) };
}

function localDate(tz: string, at: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}
function localTime(tz: string, at: Date) {
  return at.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
}

// Rises with no meal logged: queue each one, text in real time when it's fresh,
// and fold late-arriving ones into one evening summary.
async function processUnloggedRises(
  supabase: ReturnType<typeof createClient>,
  now: Date,
  signal: AbortSignal,
) {
  const stats = { users: 0, queued: 0, cancelled: 0, sent: 0, digests: 0 };
  const since = new Date(now.getTime() - 14 * 3.6e6);

  // Unanswered rise texts stop matching replies after 12 hours.
  await supabase.from("spike_events").update({ status: "expired" })
    .eq("kind", "unlogged").eq("status", "sent").lt("sms_sent_at", new Date(now.getTime() - 12 * 3.6e6).toISOString());

  const { data: recent } = await supabase.from("cgm_readings").select("user_id")
    .gte("ts", new Date(now.getTime() - 12 * 3.6e6).toISOString()).limit(5000);
  const users = [...new Set((recent ?? []).map((r: any) => r.user_id as string))];

  for (const userId of users) {
    stats.users++;
    const [{ data: cgm }, { data: meals }, { data: existing }, { data: prefs }, { data: eng }, { data: drafts }] = await Promise.all([
      supabase.from("cgm_readings").select("ts, mg_dl").eq("user_id", userId).gte("ts", since.toISOString()).order("ts").limit(1000),
      supabase.from("food_logs").select("logged_at").eq("user_id", userId).in("type", ["food", "drink"])
        .gte("logged_at", new Date(since.getTime() - 2 * 3.6e6).toISOString()),
      supabase.from("spike_events").select("id, rise_start_at, status, sms_sent_at, digest_date")
        .eq("user_id", userId).eq("kind", "unlogged").gte("rise_start_at", new Date(since.getTime() - 3.6e6).toISOString()),
      supabase.from("notification_prefs").select("spike_enabled, post_meal_sms_enabled, sms_provider, quiet_start_hour, quiet_end_hour, persona_type, persona_name, voice_style")
        .eq("user_id", userId).maybeSingle(),
      supabase.from("user_engagement").select("phone, timezone").eq("user_id", userId).maybeSingle(),
      supabase.from("sms_pending_logs").select("id").eq("user_id", userId).eq("status", "pending")
        .gte("created_at", new Date(now.getTime() - 6 * 3.6e6).toISOString()).limit(1),
    ]);
    if (prefs && prefs.spike_enabled === false) continue;

    const tz = (eng as any)?.timezone || "America/Chicago";
    const mealTimes = (meals ?? []).map((m: any) => Date.parse(m.logged_at));
    const rows = (existing ?? []) as any[];

    // Queue new rises (skip ones already queued within 30 minutes of the same start).
    const found = detectRises((cgm ?? []).map((c: any) => ({ t: Date.parse(c.ts), v: Number(c.mg_dl) })), mealTimes);
    for (const r of found) {
      if (rows.some((x) => Math.abs(Date.parse(x.rise_start_at) - r.start) < 30 * 60000)) continue;
      const { data: ins } = await supabase.from("spike_events").insert({
        user_id: userId, kind: "unlogged", status: "queued",
        rise_start_at: new Date(r.start).toISOString(), detected_at: new Date(r.start).toISOString(),
        baseline_mg_dl: r.startValue, peak_mg_dl: r.peak, rise_mg_dl: r.peak - r.startValue,
        window_min: Math.round((r.peakAt - r.start) / 60000), sensitivity: "unlogged", user_response: "pending",
      }).select("id, rise_start_at, status, sms_sent_at, digest_date").maybeSingle();
      if (ins) { rows.push(ins); stats.queued++; }
    }

    // A meal logged for that time cancels anything not yet texted.
    for (const x of rows) {
      if ((x.status === "queued" || (x.status === "digest" && !x.sms_sent_at)) &&
          mealTimes.some((m) => mealCovers(m, Date.parse(x.rise_start_at)))) {
        await supabase.from("spike_events").update({ status: "cancelled" }).eq("id", x.id);
        x.status = "cancelled"; stats.cancelled++;
      }
    }

    const phone = (eng as any)?.phone as string | undefined;
    if (!phone || !prefs?.post_meal_sms_enabled) continue;
    const hour = localHour(tz, now);
    const quiet = quietNow(prefs?.quiet_start_hour ?? 21, prefs?.quiet_end_hour ?? 8, hour);
    const today = localDate(tz, now);
    const sentToday = rows.filter((x) => x.sms_sent_at && localDate(tz, new Date(x.sms_sent_at)) === today && x.status !== "digest")
      .map((x) => Date.parse(x.sms_sent_at));

    const plan = planRiseTexts({
      queued: rows.filter((x) => x.status === "queued").map((x) => ({ id: x.id, start: Date.parse(x.rise_start_at) })),
      now: now.getTime(), sentToday, quiet, draftWaiting: Boolean(drafts?.length),
    });
    for (const id of plan.toDigest) {
      const x = rows.find((y) => y.id === id)!;
      const d = localDate(tz, new Date(x.rise_start_at));
      await supabase.from("spike_events").update({ status: "digest", digest_date: d }).eq("id", id);
      x.status = "digest"; x.digest_date = d;
    }

    if (plan.sendNow) {
      const x = rows.find((y) => y.id === plan.sendNow)!;
      const body = await generateNudge({
        purpose: "rise",
        context: `Your glucose started rising around ${localTime(tz, new Date(x.rise_start_at))} and I don't see a meal logged then.`,
        requiredAction: "Did you eat something? Text me what you had and I'll log it, or reply NO if you didn't eat.",
      }, prefs ?? {}, signal);
      const res = await sendSms(phone, body, (prefs?.sms_provider as SmsProvider) ?? "twilio", {
        userId, purpose: "rise with no meal", relatedTable: "spike_events", relatedId: x.id,
      });
      if (res.ok) {
        await supabase.from("spike_events").update({ status: "sent", sms_sent_at: now.toISOString() }).eq("id", x.id);
        stats.sent++;
      }
    }

    // Evening summary of today's late-arriving rises.
    const digest = rows.filter((x) => x.status === "digest" && !x.sms_sent_at && x.digest_date === today)
      .sort((a, b) => Date.parse(a.rise_start_at) - Date.parse(b.rise_start_at));
    if (hour === DIGEST_HOUR && !quiet && digest.length && !drafts?.length) {
      const times = digest.map((x) => localTime(tz, new Date(x.rise_start_at)));
      const list = times.length === 1 ? times[0] : `${times.slice(0, -1).join(", ")} and ${times[times.length - 1]}`;
      const body = await generateNudge({
        purpose: "rise",
        context: `I noticed ${digest.length === 1 ? "a rise" : `${digest.length} rises`} today without a meal logged — around ${list}.`,
        requiredAction: `Text me what you ate with the time, like "${times[0]} salmon and rice", or reply NO if you didn't eat.`,
      }, prefs ?? {}, signal);
      const res = await sendSms(phone, body, (prefs?.sms_provider as SmsProvider) ?? "twilio", {
        userId, purpose: "rise summary", relatedTable: "spike_events", relatedId: digest[0].id,
      });
      if (res.ok) {
        await supabase.from("spike_events").update({ status: "sent", sms_sent_at: now.toISOString() })
          .in("id", digest.map((x) => x.id));
        stats.digests++;
      }
    }
  }
  return stats;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    // Look at every pending reminder for meals in the last 6 hours, not just
    // the ones already past their timer — a spike can fire one early.
    const cutoff = new Date(now.getTime() - 6 * 3.6e6).toISOString();
    const horizon = new Date(now.getTime() + 6 * 3.6e6).toISOString();

    const { data: due, error } = await supabase
      .from("meal_reminders")
      .select("id, user_id, meal_label, due_at, sms_sent_at, food_log_id, food_logs(logged_at)")
      .eq("status", "pending")
      .is("sms_sent_at", null)
      .gte("due_at", cutoff)
      .lte("due_at", horizon)
      .limit(200);

    if (error) throw error;

    let sentCount = 0;
    let spikeCount = 0;

    for (const r of (due ?? []) as any[]) {
      const [{ data: prefs }, { data: engagement }] = await Promise.all([
        supabase
          .from("notification_prefs")
          .select(
            "post_meal_enabled, post_meal_sms_enabled, post_meal_trigger, sms_provider, spike_sensitivity, quiet_start_hour, quiet_end_hour, persona_type, persona_name, voice_style",
          )
          .eq("user_id", r.user_id)
          .maybeSingle(),
        supabase
          .from("user_engagement")
          .select("phone, timezone")
          .eq("user_id", r.user_id)
          .maybeSingle(),
      ]);

      if (prefs && prefs.post_meal_enabled === false) {
        await supabase.from("meal_reminders").update({ status: "cancelled" }).eq("id", r.id);
        continue;
      }

      const trigger = (prefs?.post_meal_trigger as string) ?? "auto";
      const threshold = RISE_THRESHOLD[(prefs?.spike_sensitivity as string) ?? "medium"] ?? 45;
      const mealAt = new Date(r.food_logs?.logged_at ?? r.due_at);
      const timerDue = new Date(r.due_at) <= now;

      let reason: "spike" | "timer" | null = null;
      let spike: SpikeCheck = { hasCgm: false, spiked: false, rise: null, peak: null };

      if (trigger !== "time") {
        const minutesSinceMeal = (now.getTime() - mealAt.getTime()) / 60000;
        if (minutesSinceMeal >= MIN_MINUTES_AFTER_MEAL) {
          spike = await checkSpike(supabase, r.user_id, mealAt, threshold);
          if (spike.spiked) reason = "spike";
        }
      }

      // Timer fallback: always for "time", and for "auto" when there's no CGM
      // data (or the rise never showed up by the time the timer elapsed).
      if (!reason && timerDue && trigger !== "spike") reason = "timer";

      if (!reason) continue;
      if (reason === "spike") spikeCount++;

      // Surface the check-in in-app right away when a spike pulls it forward.
      const patch: Record<string, unknown> = { trigger_reason: reason };
      if (reason === "spike" && !timerDue) patch.due_at = now.toISOString();

      // SMS is opt-in; the in-app card still shows for everyone else.
      const canText = Boolean(prefs?.post_meal_sms_enabled && engagement?.phone);
      // Default to no texts between 9pm and 8am local when unset.
      const quiet = quietNow(
        prefs?.quiet_start_hour ?? 21,
        prefs?.quiet_end_hour ?? 8,
        localHour((engagement as any)?.timezone ?? null, now),
      );

      if (!canText || quiet) {
        await supabase.from("meal_reminders").update(patch).eq("id", r.id);
        continue;
      }

      const body = await generateNudge({
        purpose: "post_meal",
        context: reason === "spike"
          ? `This is a check-in after the member's ${r.meal_label}; their glucose changed afterward.`
          : `This is a scheduled check-in after the member's ${r.meal_label}.`,
        requiredAction: "Reply with a few words about how you feel and they will be added to your journal.",
      }, prefs ?? {}, req.signal);

      const result = await sendSms(
        engagement!.phone as string,
        body,
        (prefs?.sms_provider as SmsProvider) ?? "twilio",
        {
          userId: r.user_id as string,
          purpose: "post-meal check-in",
          relatedTable: "meal_reminders",
          relatedId: r.id as string,
          metadata: { meal_label: r.meal_label, trigger: patch.trigger_reason ?? null },
        },
      );

      if (result.ok) {
        await supabase
          .from("meal_reminders")
          .update({ ...patch, sms_sent_at: now.toISOString(), sms_provider: result.provider })
          .eq("id", r.id);
        sentCount++;
      } else {
        console.error("meal reminder sms failed", r.id, result.error);
        await supabase.from("meal_reminders").update(patch).eq("id", r.id);
      }
    }

    const rises = await processUnloggedRises(supabase, now, req.signal);

    return new Response(
      JSON.stringify({
        ok: true,
        candidates: due?.length ?? 0,
        sent_count: sentCount,
        spike_triggered: spikeCount,
        rises,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("send-meal-reminders error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
