// Analyze a food log against CGM readings and store meal response metrics.
// Non-blocking helper — called from client after a food log is saved.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Reading { ts: string; mg_dl: number }

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function computeMetrics(readings: Reading[], mealTs: Date) {
  const mealMs = mealTs.getTime();
  const pre = readings.filter((r) => {
    const dt = (new Date(r.ts).getTime() - mealMs) / 60000;
    return dt >= -30 && dt <= -5;
  });
  const post = readings.filter((r) => {
    const dt = (new Date(r.ts).getTime() - mealMs) / 60000;
    return dt >= 0 && dt <= 180;
  });
  if (post.length < 3) return { status: "insufficient_data" as const, readings_count: post.length };

  const baseline = pre.length
    ? median(pre.map((r) => Number(r.mg_dl)))
    : Number(post[0].mg_dl);

  let peakVal = -Infinity;
  let peakTs = post[0].ts;
  for (const r of post) {
    const v = Number(r.mg_dl);
    if (v > peakVal) { peakVal = v; peakTs = r.ts; }
  }
  const timeToPeak = Math.round((new Date(peakTs).getTime() - mealMs) / 60000);
  const rise = peakVal - baseline;

  // recovery: first ts after peak where value drops within baseline+20
  let recovery: number | null = null;
  const afterPeak = post.filter((r) => new Date(r.ts).getTime() > new Date(peakTs).getTime());
  for (const r of afterPeak) {
    if (Number(r.mg_dl) <= baseline + 20) {
      recovery = Math.round((new Date(r.ts).getTime() - mealMs) / 60000);
      break;
    }
  }

  const values = post.map((r) => Number(r.mg_dl));
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  // AUC above baseline (mg/dL * min) using trapezoidal rule
  let auc = 0;
  let tar = 0;
  for (let i = 1; i < post.length; i++) {
    const t1 = new Date(post[i - 1].ts).getTime();
    const t2 = new Date(post[i].ts).getTime();
    const dtMin = (t2 - t1) / 60000;
    const v1 = Math.max(0, Number(post[i - 1].mg_dl) - baseline);
    const v2 = Math.max(0, Number(post[i].mg_dl) - baseline);
    auc += ((v1 + v2) / 2) * dtMin;
    if (Number(post[i - 1].mg_dl) > 180 && Number(post[i].mg_dl) > 180) tar += dtMin;
  }

  // Variability (std dev)
  const mean = avg;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);

  // Meal score 0–100. Lower is worse.
  const risePenalty = Math.min(40, Math.max(0, (rise - 30) * 0.8));
  const recoveryPenalty = recovery == null ? 25 : Math.min(25, Math.max(0, (recovery - 90) * 0.25));
  const tarPenalty = Math.min(20, tar * 0.3);
  const varPenalty = Math.min(15, Math.max(0, (std - 15) * 0.5));
  const score = Math.max(0, Math.min(100, Math.round(100 - risePenalty - recoveryPenalty - tarPenalty - varPenalty)));

  return {
    status: "ready" as const,
    baseline_mg_dl: Math.round(baseline * 10) / 10,
    peak_mg_dl: Math.round(peakVal * 10) / 10,
    glucose_rise: Math.round(rise * 10) / 10,
    time_to_peak_min: timeToPeak,
    recovery_time_min: recovery,
    avg_mg_dl: Math.round(avg * 10) / 10,
    auc: Math.round(auc),
    time_above_range_min: Math.round(tar),
    meal_score: score,
    readings_count: post.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { food_log_id } = await req.json();
    if (!food_log_id || typeof food_log_id !== "string") {
      return new Response(JSON.stringify({ error: "food_log_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: log, error: logErr } = await supabase
      .from("food_logs").select("id,user_id,type,logged_at").eq("id", food_log_id).maybeSingle();
    if (logErr || !log) return new Response(JSON.stringify({ error: "log_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (log.type !== "food" && log.type !== "drink") {
      return new Response(JSON.stringify({ skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const mealTs = new Date(log.logged_at);
    const start = new Date(mealTs.getTime() - 30 * 60 * 1000).toISOString();
    const end = new Date(mealTs.getTime() + 180 * 60 * 1000).toISOString();

    const { data: readings } = await supabase
      .from("cgm_readings").select("ts,mg_dl")
      .gte("ts", start).lte("ts", end).order("ts", { ascending: true });

    const metrics = computeMetrics((readings ?? []) as Reading[], mealTs);

    const row = {
      user_id: log.user_id,
      food_log_id: log.id,
      status: metrics.status,
      readings_count: metrics.readings_count ?? 0,
      ...("baseline_mg_dl" in metrics ? metrics : {}),
      computed_at: new Date().toISOString(),
    };

    const { error: upErr } = await supabase
      .from("meal_responses").upsert(row, { onConflict: "food_log_id" });
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ok: true, metrics }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("analyze-meal-response error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
