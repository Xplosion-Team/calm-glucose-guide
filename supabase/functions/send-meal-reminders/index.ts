// Cron-triggered: delivers post-meal check-in reminders.
// A reminder row is created by a database trigger whenever a food/drink entry
// is saved; this function texts the person once the reminder comes due.
// In-app delivery is handled by the client reading the same table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSms, type SmsProvider } from "../_shared/sms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function quietNow(startHour: number | null, endHour: number | null, hour: number) {
  if (startHour === null || endHour === null) return false;
  if (startHour === endHour) return false;
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const cutoff = new Date(now.getTime() - 6 * 3.6e6).toISOString();

    const { data: due, error } = await supabase
      .from("meal_reminders")
      .select("id, user_id, meal_label, due_at, sms_sent_at")
      .eq("status", "pending")
      .is("sms_sent_at", null)
      .lte("due_at", now.toISOString())
      .gte("due_at", cutoff)
      .limit(200);

    if (error) throw error;

    let sentCount = 0;

    for (const r of due ?? []) {
      const [{ data: prefs }, { data: engagement }] = await Promise.all([
        supabase
          .from("notification_prefs")
          .select("post_meal_enabled, post_meal_sms_enabled, sms_provider, quiet_start_hour, quiet_end_hour")
          .eq("user_id", r.user_id)
          .maybeSingle(),
        supabase
          .from("user_engagement")
          .select("phone")
          .eq("user_id", r.user_id)
          .maybeSingle(),
      ]);

      if (prefs && prefs.post_meal_enabled === false) {
        await supabase.from("meal_reminders").update({ status: "cancelled" }).eq("id", r.id);
        continue;
      }
      // SMS is opt-in; the in-app card still shows for everyone else.
      if (!prefs?.post_meal_sms_enabled) continue;
      if (!engagement?.phone) continue;

      if (quietNow(prefs.quiet_start_hour ?? null, prefs.quiet_end_hour ?? null, now.getUTCHours())) {
        continue;
      }

      const body =
        `Checking in about your ${r.meal_label} 🌿 How are you feeling now? ` +
        `Reply with a few words and I'll add it to your journal.`;

      const result = await sendSms(
        engagement.phone,
        body,
        (prefs.sms_provider as SmsProvider) ?? "twilio",
      );

      if (result.ok) {
        await supabase
          .from("meal_reminders")
          .update({ sms_sent_at: now.toISOString(), sms_provider: result.provider })
          .eq("id", r.id);
        sentCount++;
      } else {
        console.error("meal reminder sms failed", r.id, result.error);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, due_count: due?.length ?? 0, sent_count: sentCount }),
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
