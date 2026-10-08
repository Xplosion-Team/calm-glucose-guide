// Sends a one-off test SMS to the signed-in person's phone number so we can
// verify the Twilio / RingCentral wiring end to end.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSms, type SmsProvider } from "../_shared/sms.ts";
import { generateNudge } from "../_shared/nudgePersona.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function toE164(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return raw;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: { provider?: string } = {};
    try {
      body = await req.json();
    } catch (_) { /* empty body is fine */ }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const [{ data: engagement }, { data: prefs }] = await Promise.all([
      service.from("user_engagement").select("phone").eq("user_id", user.id).maybeSingle(),
      service.from("notification_prefs").select("persona_type, persona_name, voice_style, sms_provider").eq("user_id", user.id).maybeSingle(),
    ]);
    const target = engagement?.phone ?? user.phone;
    if (!target) {
      return new Response(JSON.stringify({ error: "No phone number on file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const provider = ((body.provider ?? prefs?.sms_provider) === "ringcentral" ? "ringcentral" : "twilio") as SmsProvider;
    const text = await generateNudge({
      purpose: "test",
      context: "This is a test of the member's reminder style.",
      requiredAction: "No reply is needed.",
    }, prefs ?? {}, req.signal);

    const result = await sendSms(toE164(target), text, provider, {
      userId: user.id,
      purpose: "test message",
    });

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-test-sms error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
