// One-off admin utility: points the project's Twilio number at the
// sms-inbound edge function so replies are captured automatically.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_PHONE_NUMBER");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!sid || !token || !from || !supabaseUrl) {
      return new Response(JSON.stringify({ error: "Twilio credentials are not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = `Basic ${btoa(`${sid}:${token}`)}`;
    const webhook = `${supabaseUrl}/functions/v1/sms-inbound`;

    const listResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(from)}`,
      { headers: { Authorization: auth } },
    );
    if (!listResp.ok) {
      const details = await listResp.text();
      console.error(`Twilio lookup failed [${listResp.status}]: ${details}`);
      return new Response(JSON.stringify({ error: "Twilio lookup failed", status: listResp.status, details }), {
        status: listResp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const list = await listResp.json();
    const number = list.incoming_phone_numbers?.[0];
    if (!number) {
      return new Response(JSON.stringify({ error: `No Twilio number found matching ${from}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updateResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${number.sid}.json`,
      {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          SmsUrl: webhook,
          SmsMethod: "POST",
          SmsFallbackUrl: "",
        }),
      },
    );
    if (!updateResp.ok) {
      const details = await updateResp.text();
      console.error(`Twilio webhook update failed [${updateResp.status}]: ${details}`);
      return new Response(JSON.stringify({ error: "Twilio update failed", status: updateResp.status, details }), {
        status: updateResp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const updated = await updateResp.json();

    // A number attached to a Messaging Service ignores its own SmsUrl — the
    // service's inbound webhook wins, so point that at us too.
    let messagingService: Record<string, unknown> | null = null;
    const serviceSid = updated.messaging_service_sid ?? number.messaging_service_sid;
    if (serviceSid) {
      const svcResp = await fetch(
        `https://messaging.twilio.com/v1/Services/${serviceSid}`,
        {
          method: "POST",
          headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ InboundRequestUrl: webhook, InboundMethod: "POST" }),
        },
      );
      const svcBody = await svcResp.text();
      if (!svcResp.ok) {
        console.error(`Messaging Service webhook update failed [${svcResp.status}]: ${svcBody}`);
        messagingService = { sid: serviceSid, error: svcBody, status: svcResp.status };
      } else {
        const svc = JSON.parse(svcBody);
        messagingService = { sid: svc.sid, inbound_request_url: svc.inbound_request_url };
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        phone_number: updated.phone_number,
        sms_url: updated.sms_url,
        messaging_service: messagingService,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("configure-twilio-webhook error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
