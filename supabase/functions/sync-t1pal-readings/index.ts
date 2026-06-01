// T1Pal: pull recent CGM entries for the authenticated user (or all active
// connections when invoked with a service token on schedule) and append them
// to cgm_readings with source = 't1pal'. Isolated and idempotent.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface NSEntry {
  sgv?: number;
  date?: number;
  direction?: string;
  device?: string;
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

function isUnsafeHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0" || h === "::1") return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    if (a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

function safeUrl(baseUrl: string): string | null {
  try {
    const u = new URL(baseUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (isUnsafeHost(u.hostname)) return null;
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

async function syncOneConnection(
  serviceClient: ReturnType<typeof createClient>,
  conn: {
    user_id: string;
    t1pal_url: string;
    access_token_encrypted: string | null;
    last_sync_at: string | null;
  },
): Promise<{ fetched: number; inserted: number; error?: string }> {
  const started = Date.now();
  const { data: logRow } = await serviceClient
    .from("t1pal_ingestion_logs")
    .insert({ user_id: conn.user_id, status: "pending" })
    .select("id")
    .single();
  const logId = (logRow as { id?: string } | null)?.id;

  const finish = async (status: "ok" | "error", fetched: number, inserted: number, error?: string) => {
    if (!logId) return;
    await serviceClient
      .from("t1pal_ingestion_logs")
      .update({
        finished_at: new Date().toISOString(),
        status,
        readings_fetched: fetched,
        readings_inserted: inserted,
        latency_ms: Date.now() - started,
        error_message: error ?? null,
      })
      .eq("id", logId);
  };

  const baseUrl = safeUrl(conn.t1pal_url);
  if (!baseUrl) {
    await serviceClient.from("t1pal_connections").update({ status: "connection_error", last_error: "Invalid URL" }).eq("user_id", conn.user_id);
    await finish("error", 0, 0, "Invalid URL");
    return { fetched: 0, inserted: 0, error: "Invalid URL" };
  }

  const since = conn.last_sync_at ? new Date(conn.last_sync_at).getTime() : Date.now() - 24 * 60 * 60 * 1000;
  let url = `${baseUrl}/api/v1/entries.json?count=288&find[date][$gt]=${since}`;
  if (conn.access_token_encrypted) url += `&token=${encodeURIComponent(conn.access_token_encrypted)}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" }, signal: controller.signal });
  } catch (e) {
    clearTimeout(t);
    const msg = (e as Error).message;
    await serviceClient.from("t1pal_connections").update({ status: "connection_error", last_error: msg }).eq("user_id", conn.user_id);
    await finish("error", 0, 0, msg);
    return { fetched: 0, inserted: 0, error: msg };
  }
  clearTimeout(t);

  if (!res.ok) {
    const msg = `T1Pal responded ${res.status}`;
    await serviceClient.from("t1pal_connections").update({ status: "connection_error", last_error: msg }).eq("user_id", conn.user_id);
    await finish("error", 0, 0, msg);
    return { fetched: 0, inserted: 0, error: msg };
  }

  const entries: NSEntry[] = await res.json().catch(() => []);
  const nowMs = Date.now();
  const valid = entries.filter(
    (e) =>
      typeof e.sgv === "number" &&
      e.sgv >= 20 &&
      e.sgv <= 600 &&
      typeof e.date === "number" &&
      e.date > 0 &&
      e.date <= nowMs + 60_000,
  );

  let inserted = 0;
  let latestReading: string | null = null;

  if (valid.length > 0) {
    const tsList = valid.map((e) => new Date(e.date!).toISOString());
    const { data: existing } = await serviceClient
      .from("cgm_readings")
      .select("ts")
      .eq("user_id", conn.user_id)
      .in("ts", tsList);
    const existingSet = new Set((existing as { ts: string }[] | null)?.map((r) => r.ts) ?? []);

    const rows = valid
      .map((e) => ({
        user_id: conn.user_id,
        ts: new Date(e.date!).toISOString(),
        mg_dl: e.sgv!,
        trend: mapDirection(e.direction),
        source: "t1pal",
      }))
      .filter((r) => !existingSet.has(r.ts));

    if (rows.length > 0) {
      const { error: insErr } = await serviceClient.from("cgm_readings").insert(rows);
      if (insErr) {
        await finish("error", valid.length, 0, insErr.message);
        return { fetched: valid.length, inserted: 0, error: insErr.message };
      }
      inserted = rows.length;
    }
    latestReading = new Date(Math.max(...valid.map((e) => e.date!))).toISOString();
  }

  const nowIso = new Date().toISOString();
  await serviceClient
    .from("t1pal_connections")
    .update({
      status: "connected",
      last_sync_at: nowIso,
      last_successful_reading_at: latestReading ?? conn.last_sync_at,
      last_error: null,
    })
    .eq("user_id", conn.user_id);

  await finish("ok", valid.length, inserted);
  return { fetched: valid.length, inserted };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization");
  const isScheduled = req.headers.get("x-scheduled") === "true";

  try {
    if (isScheduled) {
      // Scheduled cron path: iterate all active connections.
      const { data: conns } = await serviceClient
        .from("t1pal_connections")
        .select("user_id, t1pal_url, access_token_encrypted, last_sync_at")
        .neq("status", "disabled");
      let total = 0;
      for (const c of (conns ?? []) as any[]) {
        const r = await syncOneConnection(serviceClient, c);
        total += r.inserted;
      }
      return new Response(JSON.stringify({ ok: true, inserted: total }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User-invoked path.
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
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { data: conn } = await serviceClient
      .from("t1pal_connections")
      .select("user_id, t1pal_url, access_token_encrypted, last_sync_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (!conn) {
      return new Response(JSON.stringify({ ok: false, error: "No T1Pal connection" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const r = await syncOneConnection(serviceClient, conn as any);
    return new Response(JSON.stringify({ ok: !r.error, ...r }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
