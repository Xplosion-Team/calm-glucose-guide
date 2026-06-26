// Public, view-only progress endpoint. Validates a share token and returns
// aggregated progress data for the linked user. No PHI beyond aggregate stats.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TIR_LOW = 70;
const TIR_HIGH = 180;
const WINDOW_DAYS = 14;

function startOfDayISO(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token =
      url.searchParams.get("token") ||
      (req.method === "POST" ? (await req.json().catch(() => ({}))).token : null);

    if (!token || typeof token !== "string" || token.length < 16) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link, error: linkErr } = await admin
      .from("circle_share_links")
      .select("id,user_id,person_id,status,expires_at,scope")
      .eq("token", token)
      .maybeSingle();

    if (linkErr || !link) {
      return new Response(JSON.stringify({ error: "Link not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (link.status !== "active") {
      return new Response(JSON.stringify({ error: "Link revoked" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      await admin
        .from("circle_share_links")
        .update({ status: "expired" })
        .eq("id", link.id);
      return new Response(JSON.stringify({ error: "Link expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sinceISO = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    const userId = link.user_id;

    const [readingsRes, foodRes, personRes, profileRes, t1palRes] = await Promise.all([
      admin
        .from("cgm_readings")
        .select("mg_dl,ts")
        .eq("user_id", userId)
        .gte("ts", sinceISO)
        .order("ts", { ascending: false })
        .limit(5000),
      admin
        .from("food_logs")
        .select("logged_at,type")
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
        .limit(500),
      admin
        .from("circle_people")
        .select("full_name")
        .eq("id", link.person_id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("t1pal_connections")
        .select("status,last_sync_at")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const readings = readingsRes.data ?? [];
    const logs = foodRes.data ?? [];

    let avg: number | null = null;
    let tir: number | null = null;
    if (readings.length) {
      avg = Math.round(readings.reduce((a: number, r: any) => a + r.mg_dl, 0) / readings.length);
      const inRange = readings.filter(
        (r: any) => r.mg_dl >= TIR_LOW && r.mg_dl <= TIR_HIGH,
      ).length;
      tir = Math.round((inRange / readings.length) * 100);
    }

    const dayKeys = new Set<string>();
    for (const r of readings) dayKeys.add(startOfDayISO(new Date(r.ts)));
    for (const l of logs) dayKeys.add(startOfDayISO(new Date(l.logged_at)));

    // Fire-and-forget update of view tracking
    admin
      .from("circle_share_links")
      .update({
        last_viewed_at: new Date().toISOString(),
        view_count: (await admin
          .from("circle_share_links")
          .select("view_count")
          .eq("id", link.id)
          .maybeSingle()).data?.view_count + 1 || 1,
      })
      .eq("id", link.id)
      .then(() => {});

    return new Response(
      JSON.stringify({
        scope: link.scope,
        sharedFor: personRes.data?.full_name ?? null,
        ownerName: profileRes.data?.display_name ?? null,
        windowDays: WINDOW_DAYS,
        stats: {
          avgGlucose: avg,
          timeInRangePct: tir,
          daysTracked: dayKeys.size,
          totalReadings: readings.length,
          totalLogs: logs.length,
        },
        t1pal: t1palRes.data
          ? { status: t1palRes.data.status, lastSyncAt: t1palRes.data.last_sync_at }
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
