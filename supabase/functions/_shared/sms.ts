// Pluggable SMS sender. Supports Twilio (default) and RingCentral.
// Callers pass a provider name; if that provider isn't configured we fall back
// to whichever one is, so a missing credential never silently drops a message.

export type SmsProvider = "twilio" | "ringcentral";

export interface SmsResult {
  ok: boolean;
  provider: SmsProvider | null;
  error?: string;
}

function twilioConfigured() {
  return Boolean(
    Deno.env.get("TWILIO_ACCOUNT_SID") &&
      Deno.env.get("TWILIO_AUTH_TOKEN") &&
      Deno.env.get("TWILIO_PHONE_NUMBER"),
  );
}

function ringCentralConfigured() {
  return Boolean(
    Deno.env.get("RINGCENTRAL_CLIENT_ID") &&
      Deno.env.get("RINGCENTRAL_CLIENT_SECRET") &&
      Deno.env.get("RINGCENTRAL_JWT") &&
      Deno.env.get("RINGCENTRAL_PHONE_NUMBER"),
  );
}

async function sendViaTwilio(to: string, body: string): Promise<SmsResult> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const token = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const from = Deno.env.get("TWILIO_PHONE_NUMBER")!;

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );

  if (!resp.ok) {
    const details = await resp.text();
    console.error(`Twilio send failed [${resp.status}]: ${details}`);
    return { ok: false, provider: "twilio", error: `[${resp.status}] ${details}` };
  }
  return { ok: true, provider: "twilio" };
}

// RingCentral: JWT grant -> access token -> SMS endpoint.
// Token is cached in memory for the life of the isolate.
let rcToken: { value: string; expiresAt: number } | null = null;

async function ringCentralToken(server: string): Promise<string> {
  if (rcToken && rcToken.expiresAt > Date.now() + 30_000) return rcToken.value;

  const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET")!;
  const jwt = Deno.env.get("RINGCENTRAL_JWT")!;

  const resp = await fetch(`${server}/restapi/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!resp.ok) {
    const details = await resp.text();
    throw new Error(`RingCentral auth failed [${resp.status}]: ${details}`);
  }

  const json = await resp.json();
  rcToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return rcToken.value;
}

async function sendViaRingCentral(to: string, body: string): Promise<SmsResult> {
  const server = Deno.env.get("RINGCENTRAL_SERVER_URL") ?? "https://platform.ringcentral.com";
  const from = Deno.env.get("RINGCENTRAL_PHONE_NUMBER")!;

  try {
    const token = await ringCentralToken(server);
    const resp = await fetch(
      `${server}/restapi/v1.0/account/~/extension/~/sms`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: { phoneNumber: from },
          to: [{ phoneNumber: to }],
          text: body,
        }),
      },
    );

    if (!resp.ok) {
      const details = await resp.text();
      console.error(`RingCentral send failed [${resp.status}]: ${details}`);
      // Token may have been revoked — drop the cache so the next call re-auths.
      if (resp.status === 401) rcToken = null;
      return { ok: false, provider: "ringcentral", error: `[${resp.status}] ${details}` };
    }
    return { ok: true, provider: "ringcentral" };
  } catch (e) {
    console.error("RingCentral send error", e);
    return { ok: false, provider: "ringcentral", error: String(e) };
  }
}

export async function sendSms(
  to: string,
  body: string,
  preferred: SmsProvider = "twilio",
): Promise<SmsResult> {
  const order: SmsProvider[] = preferred === "ringcentral"
    ? ["ringcentral", "twilio"]
    : ["twilio", "ringcentral"];

  for (const provider of order) {
    if (provider === "twilio" && twilioConfigured()) return await sendViaTwilio(to, body);
    if (provider === "ringcentral" && ringCentralConfigured()) {
      return await sendViaRingCentral(to, body);
    }
  }

  return { ok: false, provider: null, error: "No SMS provider is configured" };
}
