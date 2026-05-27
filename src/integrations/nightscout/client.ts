// Thin client for the isolated Nightscout edge functions.
// Does NOT touch any existing Supabase tables/queries from the app.

import { supabase } from "@/integrations/supabase/client";

export interface NightscoutConnection {
  base_url: string;
  enabled: boolean;
  last_sync_at: string | null;
  last_sync_count: number;
  last_error: string | null;
}

export interface NightscoutTestResult {
  ok: boolean;
  base_url?: string;
  latest_mg_dl?: number | null;
  latest_at?: string | null;
  error?: string;
}

export interface NightscoutSyncResult {
  ok: boolean;
  fetched?: number;
  inserted?: number;
  last_sync_at?: string;
  error?: string;
}

export async function getNightscoutConnection(): Promise<NightscoutConnection | null> {
  const { data, error } = await supabase
    .from("nightscout_connections" as never)
    .select("base_url, enabled, last_sync_at, last_sync_count, last_error")
    .maybeSingle();
  if (error) return null;
  return (data as unknown as NightscoutConnection) ?? null;
}

export async function testNightscout(input: {
  base_url: string;
  api_secret?: string;
  access_token?: string;
}): Promise<NightscoutTestResult> {
  const baseUrl = normalizeBaseUrl(input.base_url);
  if (!baseUrl) {
    return { ok: false, error: "Please enter your Nightscout site URL, like mirna-elizondo01.nightscoutpro.com" };
  }
  const { data, error } = await supabase.functions.invoke("nightscout-test", {
    body: {
      base_url: baseUrl,
      api_secret: input.api_secret?.trim() || undefined,
      access_token: input.access_token?.trim() || undefined,
    },
  });
  if (error) return { ok: false, error: error.message };
  return data as NightscoutTestResult;
}

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeBaseUrl(url: string): string | null {
  try {
    let raw = url.trim();
    if (!raw) return null;
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

export async function saveNightscoutConnection(input: {
  base_url: string;
  api_secret?: string;
  access_token?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { ok: false, error: "Not signed in" };
  const baseUrl = normalizeBaseUrl(input.base_url);
  if (!baseUrl) return { ok: false, error: "Invalid URL" };

  const payload: Record<string, unknown> = {
    user_id: userData.user.id,
    base_url: baseUrl,
    enabled: true,
    last_error: null,
  };
  if (input.access_token) {
    payload.access_token = input.access_token;
    payload.api_secret_hash = null;
  } else if (input.api_secret) {
    payload.api_secret_hash = await sha1Hex(input.api_secret);
    payload.access_token = null;
  }

  const { error } = await supabase
    .from("nightscout_connections" as never)
    .upsert(payload as never, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function disconnectNightscout(): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("nightscout_connections" as never)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function syncNightscoutNow(): Promise<NightscoutSyncResult> {
  const { data, error } = await supabase.functions.invoke("nightscout-sync", { body: {} });
  if (error) return { ok: false, error: error.message };
  return data as NightscoutSyncResult;
}
