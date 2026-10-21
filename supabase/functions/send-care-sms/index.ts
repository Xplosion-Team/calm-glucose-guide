// Sends a care team chat message to a member's phone as a text message.
// Staff-only (admin or clinician). The chat row is written by the app; this
// function only delivers the text, with skip_mirror so it isn't duplicated.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { sendSms, type SmsProvider } from "../_shared/sms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

const BodySchema = z.object({
  memberId: z.string().uuid(),
  body: z.string().min(1).max(1000),
});

function toE164(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return raw;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { memberId, body } = parsed.data;

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: staff } = await service.rpc("is_staff", { _user_id: user.id });
    if (!staff) return json({ error: "Care team only" }, 403);

    const { data: engagement } = await service
      .from("user_engagement").select("phone").eq("user_id", memberId).maybeSingle();
    if (!engagement?.phone) return json({ error: "This member has no phone number on file" }, 400);

    const result = await sendSms(toE164(engagement.phone), body, "twilio", {
      userId: memberId,
      purpose: "care_chat",
      metadata: { skip_mirror: true, sent_by: user.id },
    });
    if (!result.ok) return json({ error: "Text could not be sent" }, 502);
    return json({ ok: true, provider: result.provider satisfies SmsProvider });
  } catch (e) {
    console.error("send-care-sms error", e);
    return json({ error: "Unexpected error" }, 500);
  }
});
