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
            "post_meal_enabled, post_meal_sms_enabled, post_meal_trigger, sms_provider, spike_sensitivity, quiet_start_hour, quiet_end_hour",
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

      const body =
        reason === "spike"
          ? `Your glucose has been climbing since your ${r.meal_label} 🌿 How are you feeling? ` +
            `Reply with a few words and I'll add it to your journal.`
          : `Checking in about your ${r.meal_label} 🌿 How are you feeling now? ` +
            `Reply with a few words and I'll add it to your journal.`;

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

    return new Response(
      JSON.stringify({
        ok: true,
        candidates: due?.length ?? 0,
        sent_count: sentCount,
        spike_triggered: spikeCount,
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
