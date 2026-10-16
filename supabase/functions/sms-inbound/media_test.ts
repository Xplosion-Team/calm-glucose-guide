import { assertEquals, assertRejects, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { downloadPhoto, MAX_PHOTO_BYTES, parsePhotos, photoReplyIntent, validateMediaUrl, verifyTwilioSignature } from "./media.ts";

const account = "AC" + "a".repeat(32);
const message = "SM" + "b".repeat(32);
const media = "ME" + "c".repeat(32);
const url = `https://api.twilio.com/2010-04-01/Accounts/${account}/Messages/${message}/Media/${media}`;

Deno.test("photo-only and captioned texts create a new draft, never confirm or replace an older meal", () => {
  for (const caption of ["", "YES", "NO", "I had salmon mashed potatoes and macaroni", "I feel fine"]) {
    assertEquals(photoReplyIntent(caption, true), "new_entry");
  }
  assertEquals(photoReplyIntent("EDIT salmon and rice", true), "correction");
  assertEquals(photoReplyIntent("STOP", true), "stop");
  assertEquals(photoReplyIntent("YES", false), "confirm");
});

Deno.test("accepts photo-only MMS and up to four photos, rejects unsupported attachments", () => {
  const form = new FormData();
  form.set("NumMedia", "1"); form.set("MediaUrl0", url); form.set("MediaContentType0", "image/png");
  assertEquals(parsePhotos(form), [{ url, mimeType: "image/png" }]);
  form.set("NumMedia", "5"); assertThrows(() => parsePhotos(form));
  form.set("NumMedia", "1"); form.set("MediaContentType0", "video/mp4"); assertThrows(() => parsePhotos(form));
});

Deno.test("media access is restricted to the same Twilio account and message", () => {
  assertEquals(validateMediaUrl(url, account, message).href, url);
  for (const bad of [url.replace("api.twilio.com", "evil.example"), url.replace("https:", "http:"), url.replace(message, "SM" + "d".repeat(32)), url + "?other=1"]) {
    assertThrows(() => validateMediaUrl(bad, account, message));
  }
});

Deno.test("validates genuine Twilio signature and rejects tampered captions", async () => {
  const form = new FormData(); form.set("Body", "lunch"); form.set("NumMedia", "1");
  const endpoint = "https://example.test/functions/v1/sms-inbound";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-token"), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(endpoint + "BodylunchNumMedia1")));
  const request = new Request(endpoint, { headers: { "x-twilio-signature": btoa(String.fromCharCode(...bytes)) } });
  assertEquals(await verifyTwilioSignature(request, form, "test-token", endpoint), true);
  form.set("Body", "tampered"); assertEquals(await verifyTwilioSignature(request, form, "test-token", endpoint), false);
});

Deno.test("photo download authenticates Twilio but never forwards credentials to CDN", async () => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; auth: string | null }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), auth: new Headers(init?.headers).get("authorization") });
    return calls.length === 1 ? new Response(null, { status: 302, headers: { location: "https://mms.twiliocdn.com/photo" } })
      : new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } });
  };
  try {
    const result = await downloadPhoto({ url, mimeType: "image/png" }, account, "test-token", message);
    assertEquals(result.mimeType, "image/png"); assertEquals(result.imageBase64, "iVBORw==");
    assertEquals(calls[0].auth?.startsWith("Basic "), true); assertEquals(calls[1].auth, null);
  } finally { globalThis.fetch = original; }
});

Deno.test("oversized photos and unsafe redirects fail without yielding image data", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: "https://evil.example/photo" } });
    await assertRejects(() => downloadPhoto({ url, mimeType: "image/png" }, account, "token", message));
    globalThis.fetch = async () => new Response("oversized", { headers: { "content-type": "image/png", "content-length": String(MAX_PHOTO_BYTES + 1) } });
    await assertRejects(() => downloadPhoto({ url, mimeType: "image/png" }, account, "token", message));
  } finally { globalThis.fetch = original; }
});