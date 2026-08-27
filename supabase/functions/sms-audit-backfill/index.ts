// Pulls the recent message history from Twilio and folds it into the
// sms_events audit log. This catches anything that happened before audit
// logging existed, and any inbound text the webhook never received.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface TwilioMessage {
  sid: string;
  direction: string;
  from: string;
  to: string;
  body: string;
  status: string;
  error_code: number | null;
  error_message: string | null;
  date_sent: string | null;
  date_created: string;
}

function phoneVariants(raw: string): string[] {
  const digits = (raw ?? "").replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return Array.from(new Set([raw, digits, ten, `1${ten}`, `+1${ten}`, `+${digits}`].filter(Boolean)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const ourNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!sid || !token || !ourNumber) {
      return new Response(JSON.stringify({ error: "Twilio credentials are not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let days = 14;
    try {
      const parsed = await req.json();
      if (typeof parsed?.days === "number" && parsed.days > 0 && parsed.days <= 90) days = parsed.days;
    } catch (_) { /* default window */ }

    const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?PageSize=200&DateSent%3E=${since}`,
      { headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` } },
    );

    if (!resp.ok) {
      const details = await resp.text();
      console.error(`Twilio message list failed [${resp.status}]: ${details}`);
      return new Response(
        JSON.stringify({ error: "Twilio request failed", status: resp.status, details }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const messages: TwilioMessage[] = (await resp.json()).messages ?? [];
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let inserted = 0;
    let skipped = 0;
    const inboundSummary: Array<{ from: string; body: string; at: string }> = [];

    for (const m of messages) {
      const inbound = m.direction === "inbound";
      const counterpart = inbound ? m.from : m.to;

      const { data: existing } = await supabase
        .from("sms_events")
        .select("id")
        .eq("metadata->>twilio_sid", m.sid)
        .maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }

      const { data: userId } = await supabase.rpc("find_user_by_phone", {
        _variants: phoneVariants(counterpart),
      });

      const failed = Boolean(m.error_code) ||
        ["failed", "undelivered"].includes((m.status ?? "").toLowerCase());

      await supabase.from("sms_events").insert({
        user_id: (userId as string) ?? null,
        direction: inbound ? "inbound" : "outbound",
        phone: counterpart,
        body: m.body ?? "",
        provider: "twilio",
        status: inbound ? "received" : failed ? "failed" : "sent",
        error_message: m.error_message ?? (m.error_code ? `Twilio error ${m.error_code}` : null),
        purpose: "recovered from Twilio history",
        outcome: inbound && !userId ? "No account matches this phone number" : null,
        metadata: { twilio_sid: m.sid, twilio_status: m.status, backfilled: true },
        occurred_at: m.date_sent ?? m.date_created,
      });
      inserted++;

      if (inbound) {
        inboundSummary.push({
          from: m.from,
          body: (m.body ?? "").slice(0, 120),
          at: m.date_sent ?? m.date_created,
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        days,
        examined: messages.length,
        inserted,
        skipped,
        inbound_found: inboundSummary.length,
        inbound: inboundSummary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sms-audit-backfill error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
