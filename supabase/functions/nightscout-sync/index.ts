// Nightscout: pull recent CGM entries for the authenticated user and append
// them to the existing cgm_readings table with source = 'nightscout'.
// Isolated, idempotent (skips duplicates by ts), and tolerant of failures.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface NightscoutEntry {
  sgv?: number;
  date?: number;
  dateString?: string;
  direction?: string;
}

function mapDirection(dir?: string): string | null {
  if (!dir) return null;
  const m: Record<string, string> = {
    DoubleUp: "doubleUp",
    SingleUp: "singleUp",
    FortyFiveUp: "fortyFiveUp",
    Flat: "flat",
    FortyFiveDown: "fortyFiveDown",
    SingleDown: "singleDown",
    DoubleDown: "doubleDown",
  };
  return m[dir] ?? dir;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  // Start sync log row (service role — RLS deny-all on writes).
  const { data: logRow } = await serviceClient
    .from("nightscout_sync_log")
    .insert({ user_id: userId, status: "pending" })
    .select("id")
    .single();
  const logId = logRow?.id;

  const finish = async (
    status: "ok" | "error",
    fetched: number,
    inserted: number,
    error?: string,
  ) => {
    if (!logId) return;
    await serviceClient
      .from("nightscout_sync_log")
      .update({
        finished_at: new Date().toISOString(),
        status,
        entries_fetched: fetched,
        entries_inserted: inserted,
        error_message: error ?? null,
      })
      .eq("id", logId);
  };

  try {
    const { data: conn } = await userClient
      .from("nightscout_connections")
      .select("base_url, api_secret_hash, access_token, enabled, last_sync_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (!conn || !conn.enabled) {
      await finish("error", 0, 0, "No active Nightscout connection");
      return new Response(
        JSON.stringify({ ok: false, error: "No active Nightscout connection" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const since = conn.last_sync_at ? new Date(conn.last_sync_at).getTime() : Date.now() - 24 * 60 * 60 * 1000;
    const headers: Record<string, string> = { accept: "application/json" };
    let url = `${conn.base_url}/api/v1/entries.json?count=288&find[date][$gt]=${since}`;
    if (conn.access_token) {
      url += `&token=${encodeURIComponent(conn.access_token)}`;
    } else if (conn.api_secret_hash) {
      headers["api-secret"] = conn.api_secret_hash;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const msg = `Nightscout responded ${res.status}`;
      await serviceClient
        .from("nightscout_connections")
        .update({ last_error: msg })
        .eq("user_id", userId);
      await finish("error", 0, 0, msg);
      return new Response(JSON.stringify({ ok: false, error: msg }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const entries: NightscoutEntry[] = await res.json();
    const valid = entries.filter(
      (e) => typeof e.sgv === "number" && e.sgv > 20 && e.sgv < 600 && typeof e.date === "number",
    );

    let inserted = 0;
    if (valid.length > 0) {
      // Check existing timestamps to avoid duplicates (idempotent).
      const tsList = valid.map((e) => new Date(e.date!).toISOString());
      const { data: existing } = await userClient
        .from("cgm_readings")
        .select("ts")
        .eq("user_id", userId)
        .in("ts", tsList);
      const existingSet = new Set((existing ?? []).map((r: { ts: string }) => r.ts));

      const rows = valid
        .map((e) => ({
          user_id: userId,
          ts: new Date(e.date!).toISOString(),
          mg_dl: e.sgv!,
          trend: mapDirection(e.direction),
          source: "nightscout",
        }))
        .filter((r) => !existingSet.has(r.ts));

      if (rows.length > 0) {
        const { error: insErr } = await userClient.from("cgm_readings").insert(rows);
        if (insErr) {
          await finish("error", valid.length, 0, insErr.message);
          return new Response(JSON.stringify({ ok: false, error: insErr.message }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        inserted = rows.length;
      }
    }

    const nowIso = new Date().toISOString();
    await serviceClient
      .from("nightscout_connections")
      .update({
        last_sync_at: nowIso,
        last_sync_count: inserted,
        last_error: null,
      })
      .eq("user_id", userId);

    await finish("ok", valid.length, inserted);

    return new Response(
      JSON.stringify({ ok: true, fetched: valid.length, inserted, last_sync_at: nowIso }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error).message;
    await finish("error", 0, 0, msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
