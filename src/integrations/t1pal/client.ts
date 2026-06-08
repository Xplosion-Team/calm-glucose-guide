import { supabase } from "@/integrations/supabase/client";

export interface T1PalConnection {
  id: string;
  user_id: string;
  t1pal_url: string;
  status: string;
  last_sync_at: string | null;
  last_successful_reading_at: string | null;
  last_insulin_sync_at: string | null;
  last_meal_sync_at: string | null;
  last_error: string | null;
}

export function normalizeT1PalUrl(url: string): string {
  let raw = (url ?? "").trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    if (!u.hostname.includes(".")) return "";
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return "";
  }
}

export async function getT1PalConnection(): Promise<T1PalConnection | null> {
  const { data } = await (supabase as any)
    .from("t1pal_connections")
    .select("id, user_id, t1pal_url, status, last_sync_at, last_successful_reading_at, last_insulin_sync_at, last_meal_sync_at, last_error")
    .maybeSingle();
  return (data as T1PalConnection | null) ?? null;
}


export async function testT1PalConnection(input: {
  t1pal_url: string;
  access_token?: string;
}): Promise<{ ok: boolean; latest_mg_dl?: number | null; latest_at?: string | null; error?: string }> {
  const t1pal_url = normalizeT1PalUrl(input.t1pal_url);
  if (!t1pal_url) return { ok: false, error: "Please enter your T1Pal site URL." };
  const { data, error } = await supabase.functions.invoke("test-t1pal-connection", {
    body: { t1pal_url, access_token: input.access_token ?? "" },
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? "Connection failed." };
  return { ok: true, latest_mg_dl: data.latest_mg_dl ?? null, latest_at: data.latest_at ?? null };
}

export async function saveT1PalConnection(input: {
  t1pal_url: string;
  access_token?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return { ok: false, error: "Not signed in." };
  const t1pal_url = normalizeT1PalUrl(input.t1pal_url);
  if (!t1pal_url) return { ok: false, error: "Invalid URL." };
  const { error } = await (supabase as any)
    .from("t1pal_connections")
    .upsert(
      {
        user_id: user.id,
        t1pal_url,
        access_token_encrypted: input.access_token || null,
        status: "connected",
        last_error: null,
      },
      { onConflict: "user_id" },
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function syncT1PalNow(): Promise<{ ok: boolean; inserted?: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke("sync-t1pal-readings", { body: {} });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? "Sync failed." };
  return { ok: true, inserted: data.inserted ?? 0 };
}

export async function disconnectT1Pal(): Promise<{ ok: boolean; error?: string }> {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await (supabase as any).from("t1pal_connections").delete().eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
