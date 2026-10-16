// Photos stay in memory only. Never persist signed URLs, credentials or image bytes.
import { interpretReply } from "./logic.ts";
export function photoReplyIntent(body: string, hasPhotos: boolean) {
  const intent = interpretReply(body);
  return hasPhotos && intent !== "stop" && intent !== "correction" ? "new_entry" : intent;
}
export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export type MealPhoto = { imageBase64: string; mimeType: string };

export function parsePhotos(form: FormData) {
  const count = Number(form.get("NumMedia") ?? 0);
  if (!Number.isInteger(count) || count < 0 || count > MAX_PHOTOS) {
    throw new Error("Please send up to four meal photos at a time.");
  }
  return Array.from({ length: count }, (_, i) => {
    const url = String(form.get(`MediaUrl${i}`) ?? "");
    const mimeType = String(form.get(`MediaContentType${i}`) ?? "").toLowerCase();
    if (!PHOTO_TYPES.includes(mimeType)) throw new Error("Please send a JPEG, PNG, WebP or GIF meal photo, or describe your meal in words.");
    return { url, mimeType };
  });
}

export function validateMediaUrl(raw: string, accountSid: string, messageSid: string) {
  const url = new URL(raw);
  const prefix = `/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}/Media/`;
  if (url.protocol !== "https:" || url.hostname !== "api.twilio.com" || url.port || url.username || url.password ||
    !url.pathname.startsWith(prefix) || !/^ME[a-f0-9]{32}$/.test(url.pathname.slice(prefix.length)) || url.search || url.hash) {
    throw new Error("The photo link could not be verified. Please describe your meal in words.");
  }
  return url;
}

export function validateCdnUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".twiliocdn.com") || url.port || url.username || url.password) {
    throw new Error("The photo download could not be verified. Please describe your meal in words.");
  }
  return url;
}

export async function verifyTwilioSignature(req: Request, form: FormData, token: string, publicUrl: string) {
  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return false;
  let payload = publicUrl;
  for (const key of [...new Set(Array.from(form.keys()))].sort()) {
    for (const value of [...new Set(form.getAll(key).map(String))].sort()) payload += key + value;
  }
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  const expected = btoa(String.fromCharCode(...digest));
  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

export async function downloadPhoto(photo: { url: string; mimeType: string }, accountSid: string, token: string, messageSid: string): Promise<MealPhoto> {
  let url = validateMediaUrl(photo.url, accountSid, messageSid);
  let response = await fetch(url, { redirect: "manual", headers: { Authorization: `Basic ${btoa(`${accountSid}:${token}`)}` } });
  for (let hop = 0; response.status >= 300 && response.status < 400 && hop < 3; hop++) {
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) throw new Error("The photo could not be opened. Please describe your meal in words.");
    url = validateCdnUrl(new URL(location, url).href);
    // Never forward Twilio credentials to a CDN or redirected host.
    response = await fetch(url, { redirect: "manual" });
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(response.status === 401 || response.status === 403
      ? "Photo access is unavailable. Please describe your meal in words while we check the messaging permissions."
      : "The photo could not be opened. Please describe your meal in words.");
  }
  const mimeType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  if (!PHOTO_TYPES.includes(mimeType) || mimeType !== photo.mimeType || Number(response.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES) {
    await response.body?.cancel();
    throw new Error("Please send a supported meal photo smaller than 5 MB.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The photo was empty. Please try another photo.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_PHOTO_BYTES) { await reader.cancel(); throw new Error("Please send a meal photo smaller than 5 MB."); }
    chunks.push(value);
  }
  if (!size) throw new Error("The photo was empty. Please try another photo.");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { imageBase64: btoa(binary), mimeType };
}