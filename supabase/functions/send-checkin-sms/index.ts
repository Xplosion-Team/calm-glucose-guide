// Cron-triggered: sends warm check-in SMS to trial users who haven't logged recently.
// Tier rules:
//   A = nudge if no log in last 24h
//   B = nudge if no log in last 48h
//   C = nudge if no log in last 36h AND total_meals_logged < 10
// Plus a 10am-local nudge if nothing logged today.
// Always positive language, no clinical content.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const MESSAGES = [
  "Good morning from Calm Glucose 🌿 A quick note about a meal or drink helps me learn your rhythm. Just text back what you had.",
  "Hi there 🌞 Whenever you have a moment, share what you ate or drank — even a few words is plenty.",
  "Thinking of you today. If you'd like, text me your last meal or snack and I'll log it for you.",
  "A gentle hello 💚 Sharing a meal helps your journey. Just reply with what you had.",
];

function pickMessage(seed: number) {
  return MESSAGES[seed % MESSAGES.length];
}

// Local hour for a user's timezone (falls back to US Central).
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
    return Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        hour12: false,
      }).format(now),
    );
  }
}

// Check-ins only ever go out inside this local-time window.
const SEND_WINDOW_START = 9;
const SEND_WINDOW_END = 12;


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const { data: rows, error } = await supabase
      .from("user_engagement")
      .select(
        "user_id, phone, timezone, trial_tier, last_log_at, last_checkin_sent_at, total_meals_logged, trial_start",
      )
      .not("phone", "is", null);

    if (error) throw error;

    const sent: string[] = [];
    for (const r of rows ?? []) {
      if (!r.phone) continue;

      // Never text outside the person's local morning window.
      const hour = localHour((r as any).timezone ?? null, now);
      if (hour < SEND_WINDOW_START || hour >= SEND_WINDOW_END) continue;

      // Don't spam: at most one check-in per 20h
      if (r.last_checkin_sent_at) {
        const since = (now.getTime() - new Date(r.last_checkin_sent_at).getTime()) / 3.6e6;
        if (since < 20) continue;
      }

      const hoursSinceLog = r.last_log_at
        ? (now.getTime() - new Date(r.last_log_at).getTime()) / 3.6e6
        : 9999;

      let shouldSend = false;
      if (r.trial_tier === "A" && hoursSinceLog >= 24) shouldSend = true;
      else if (r.trial_tier === "B" && hoursSinceLog >= 48) shouldSend = true;
      else if (r.trial_tier === "C" && hoursSinceLog >= 36 && (r.total_meals_logged ?? 0) < 10) {
        shouldSend = true;
      }

      // 10am-local nudge when nothing has been logged today.
      if (!shouldSend && hour === 10 && hoursSinceLog >= 12) shouldSend = true;


      if (!shouldSend) continue;

      const body = pickMessage(now.getUTCDate() + (r.user_id?.charCodeAt(0) ?? 0));
      const result = await sendSms(r.phone, body, "twilio", {
        userId: r.user_id as string,
        purpose: "engagement check-in",
        metadata: { trial_tier: r.trial_tier, hours_since_log: Math.round(hoursSinceLog) },
      });

      if (result.ok) {
        await supabase
          .from("user_engagement")
          .update({ last_checkin_sent_at: now.toISOString() })
          .eq("user_id", r.user_id);
        sent.push(r.phone);
      } else {
        console.error("check-in sms failed", r.phone, result.error);
      }

    }

    return new Response(JSON.stringify({ ok: true, sent_count: sent.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-checkin-sms error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
