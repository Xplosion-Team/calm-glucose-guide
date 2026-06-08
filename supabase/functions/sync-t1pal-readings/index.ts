// T1Pal: pull recent CGM entries AND treatments (insulin + meals) for the
// authenticated user (or all active connections when invoked with x-scheduled).
// Appends glucose to cgm_readings (source='t1pal'), insulin to insulin_events,
// carbs to meal_events. Isolated and idempotent.

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

interface NSTreatment {
  eventType?: string;
  insulin?: number | null;
  carbs?: number | null;
  created_at?: string;
  timestamp?: string | number;
  date?: number;
  insulinType?: string;
  notes?: string;
  [k: string]: unknown;
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

function treatmentTimeMs(t: NSTreatment): number | null {
  if (typeof t.date === "number" && t.date > 0) return t.date;
  const raw = t.created_at ?? t.timestamp;
  if (!raw) return null;
  const ms = typeof raw === "number" ? raw : Date.parse(String(raw));
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

async function fetchJson(url: string, timeoutMs = 15_000): Promise<unknown> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: c.signal });
    if (!res.ok) throw new Error(`T1Pal responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function syncOneConnection(
  serviceClient: ReturnType<typeof createClient>,
  conn: {
    user_id: string;
    t1pal_url: string;
    access_token_encrypted: string | null;
    last_sync_at: string | null;
    last_insulin_sync_at?: string | null;
    last_meal_sync_at?: string | null;
  },
): Promise<{
  fetched: number;
  inserted: number;
  insulin_fetched: number;
  insulin_inserted: number;
  meals_fetched: number;
  meals_inserted: number;
  error?: string;
}> {
  const started = Date.now();
  const { data: logRow } = await serviceClient
    .from("t1pal_ingestion_logs")
    .insert({ user_id: conn.user_id, status: "pending" })
    .select("id")
    .single();
  const logId = (logRow as { id?: string } | null)?.id;

  const finish = async (
    status: "ok" | "error",
    counts: {
      fetched: number;
      inserted: number;
      insulin_fetched: number;
      insulin_inserted: number;
      meals_fetched: number;
      meals_inserted: number;
    },
    error?: string,
  ) => {
    if (!logId) return;
    await serviceClient
      .from("t1pal_ingestion_logs")
      .update({
        finished_at: new Date().toISOString(),
        status,
        readings_fetched: counts.fetched,
        readings_inserted: counts.inserted,
        insulin_fetched: counts.insulin_fetched,
        insulin_inserted: counts.insulin_inserted,
        meals_fetched: counts.meals_fetched,
        meals_inserted: counts.meals_inserted,
        latency_ms: Date.now() - started,
        error_message: error ?? null,
      })
      .eq("id", logId);
  };

  const zero = {
    fetched: 0,
    inserted: 0,
    insulin_fetched: 0,
    insulin_inserted: 0,
    meals_fetched: 0,
    meals_inserted: 0,
  };

  const baseUrl = safeUrl(conn.t1pal_url);
  if (!baseUrl) {
    await serviceClient
      .from("t1pal_connections")
      .update({ status: "connection_error", last_error: "Invalid URL" })
      .eq("user_id", conn.user_id);
    await finish("error", zero, "Invalid URL");
    return { ...zero, error: "Invalid URL" };
  }

  const tokenQS = conn.access_token_encrypted
    ? `&token=${encodeURIComponent(conn.access_token_encrypted)}`
    : "";

  // ---------- CGM entries ----------
  const sinceCgm = conn.last_sync_at
    ? new Date(conn.last_sync_at).getTime()
    : Date.now() - 24 * 60 * 60 * 1000;
  const entriesUrl = `${baseUrl}/api/v1/entries.json?count=288&find[date][$gt]=${sinceCgm}${tokenQS}`;

  let entries: NSEntry[] = [];
  try {
    entries = (await fetchJson(entriesUrl)) as NSEntry[];
    if (!Array.isArray(entries)) entries = [];
  } catch (e) {
    const msg = (e as Error).message;
    await serviceClient
      .from("t1pal_connections")
      .update({ status: "connection_error", last_error: msg })
      .eq("user_id", conn.user_id);
    await finish("error", zero, msg);
    return { ...zero, error: msg };
  }

  const nowMs = Date.now();
  const validEntries = entries.filter(
    (e) =>
      typeof e.sgv === "number" &&
      e.sgv >= 20 &&
      e.sgv <= 600 &&
      typeof e.date === "number" &&
      e.date > 0 &&
      e.date <= nowMs + 60_000,
  );

  let insertedCgm = 0;
  let latestReading: string | null = null;
  if (validEntries.length > 0) {
    const tsList = validEntries.map((e) => new Date(e.date!).toISOString());
    const { data: existing } = await serviceClient
      .from("cgm_readings")
      .select("ts")
      .eq("user_id", conn.user_id)
      .in("ts", tsList);
    const existingSet = new Set((existing as { ts: string }[] | null)?.map((r) => r.ts) ?? []);
    const rows = validEntries
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
        await finish("error", { ...zero, fetched: validEntries.length }, insErr.message);
        return { ...zero, fetched: validEntries.length, error: insErr.message };
      }
      insertedCgm = rows.length;
    }
    latestReading = new Date(Math.max(...validEntries.map((e) => e.date!))).toISOString();
  }

  // ---------- Treatments (insulin + meals) ----------
  const sinceTreat = Math.min(
    conn.last_insulin_sync_at ? new Date(conn.last_insulin_sync_at).getTime() : Infinity,
    conn.last_meal_sync_at ? new Date(conn.last_meal_sync_at).getTime() : Infinity,
    Date.now() - 24 * 60 * 60 * 1000,
  );
  const sinceIso = new Date(sinceTreat).toISOString();
  const treatmentsUrl =
    `${baseUrl}/api/v1/treatments.json?count=500` +
    `&find[created_at][$gte]=${encodeURIComponent(sinceIso)}${tokenQS}`;

  let insulinFetched = 0;
  let insulinInserted = 0;
  let mealsFetched = 0;
  let mealsInserted = 0;
  let latestInsulin: string | null = null;
  let latestMeal: string | null = null;

  try {
    const treatments = (await fetchJson(treatmentsUrl)) as NSTreatment[];
    const list = Array.isArray(treatments) ? treatments : [];

    const insulinRows: Array<{
      user_id: string;
      ts: string;
      insulin_units: number;
      insulin_type: string | null;
      event_type: string | null;
      source: string;
      raw_payload: NSTreatment;
    }> = [];
    const mealRows: Array<{
      user_id: string;
      ts: string;
      carbohydrates: number;
      event_type: string | null;
      source: string;
      raw_payload: NSTreatment;
    }> = [];

    for (const t of list) {
      const ms = treatmentTimeMs(t);
      if (!ms || ms > nowMs + 60_000) continue;
      const iso = new Date(ms).toISOString();

      if (typeof t.insulin === "number" && t.insulin > 0 && t.insulin <= 100) {
        insulinFetched++;
        insulinRows.push({
          user_id: conn.user_id,
          ts: iso,
          insulin_units: t.insulin,
          insulin_type: typeof t.insulinType === "string" ? t.insulinType : null,
          event_type: typeof t.eventType === "string" ? t.eventType : null,
          source: "t1pal",
          raw_payload: t,
        });
        if (!latestInsulin || iso > latestInsulin) latestInsulin = iso;
      }

      if (typeof t.carbs === "number" && t.carbs > 0 && t.carbs <= 500) {
        mealsFetched++;
        mealRows.push({
          user_id: conn.user_id,
          ts: iso,
          carbohydrates: t.carbs,
          event_type: typeof t.eventType === "string" ? t.eventType : null,
          source: "t1pal",
          raw_payload: t,
        });
        if (!latestMeal || iso > latestMeal) latestMeal = iso;
      }
    }

    // Dedupe via upsert on natural unique key.
    if (insulinRows.length > 0) {
      const { error: insErr, count } = await serviceClient
        .from("insulin_events")
        .upsert(insulinRows, { onConflict: "user_id,ts,insulin_units,source", ignoreDuplicates: true, count: "exact" });
      if (insErr) throw insErr;
      insulinInserted = count ?? insulinRows.length;
    }
    if (mealRows.length > 0) {
      const { error: mErr, count } = await serviceClient
        .from("meal_events")
        .upsert(mealRows, { onConflict: "user_id,ts,carbohydrates,source", ignoreDuplicates: true, count: "exact" });
      if (mErr) throw mErr;
      mealsInserted = count ?? mealRows.length;
    }
  } catch (e) {
    // Treatments are optional — log but don't fail the whole sync.
    console.warn("T1Pal treatments sync error:", (e as Error).message);
  }

  const nowIso = new Date().toISOString();
  await serviceClient
    .from("t1pal_connections")
    .update({
      status: "connected",
      last_sync_at: nowIso,
      last_successful_reading_at: latestReading ?? conn.last_sync_at,
      last_insulin_sync_at: latestInsulin ?? conn.last_insulin_sync_at ?? null,
      last_meal_sync_at: latestMeal ?? conn.last_meal_sync_at ?? null,
      last_error: null,
    })
    .eq("user_id", conn.user_id);

  const counts = {
    fetched: validEntries.length,
    inserted: insertedCgm,
    insulin_fetched: insulinFetched,
    insulin_inserted: insulinInserted,
    meals_fetched: mealsFetched,
    meals_inserted: mealsInserted,
  };
  await finish("ok", counts);
  return counts;
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
      const { data: conns } = await serviceClient
        .from("t1pal_connections")
        .select("user_id, t1pal_url, access_token_encrypted, last_sync_at, last_insulin_sync_at, last_meal_sync_at")
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
      .select("user_id, t1pal_url, access_token_encrypted, last_sync_at, last_insulin_sync_at, last_meal_sync_at")
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
