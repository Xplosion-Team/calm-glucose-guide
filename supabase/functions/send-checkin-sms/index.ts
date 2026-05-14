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
      .select("user_id, phone, trial_tier, last_log_at, last_checkin_sent_at, total_meals_logged, trial_start")
      .not("phone", "is", null);

    if (error) throw error;

    const sent: string[] = [];
    for (const r of rows ?? []) {
      if (!r.phone) continue;

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

      // Also nudge ~10am local (rough: 10-11 UTC default; refined per-user later)
      const utcHour = now.getUTCHours();
      if (!shouldSend && utcHour >= 14 && utcHour < 15 && hoursSinceLog >= 12) shouldSend = true;

      if (!shouldSend) continue;

      const body = pickMessage(now.getUTCDate() + (r.user_id?.charCodeAt(0) ?? 0));
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const resp = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        },
        body: new URLSearchParams({ To: r.phone, From: TWILIO_PHONE_NUMBER, Body: body }),
      });

      if (resp.ok) {
        await supabase
          .from("user_engagement")
          .update({ last_checkin_sent_at: now.toISOString() })
          .eq("user_id", r.user_id);
        sent.push(r.phone);
      } else {
        console.error("twilio fail", r.phone, await resp.text());
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
