// generate-daily-insights — personalized daily coaching for T2D users.
//
// Two entry modes:
//   1. Authenticated user request { mode: "mine", date?: "YYYY-MM-DD" }
//      -> generate (or return existing) insight for the calling user.
//   2. Cron/service invocation { mode: "cron" } with a service role
//      -> iterate every user whose notification_prefs allow it and whose
//         local (UTC-approx) hour matches daily_insight_hour, and generate
//         yesterday's insight if it doesn't already exist.
//
// Output stored in public.daily_insights (unique per user/date).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MODEL_VERSION = "daily-insights-2026.07.0";

interface Reading { ts: string; mg_dl: number }
interface FoodRow { id: string; label: string; type: string; carbs_grams: number | null; portion_size: string | null; logged_at: string }
interface MedEvRow { medication_id: string; taken_at: string }
interface MedRow { id: string; name: string; med_class: string; schedule_cron: string | null }

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }

function computeMetrics(readings: Reading[]) {
  if (readings.length === 0) return null;
  const vals = readings.map((r) => Number(r.mg_dl));
  const mean = vals.reduce((a, v) => a + v, 0) / vals.length;
  const variance = vals.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(1, vals.length - 1);
  const sd = Math.sqrt(variance);
  const cv = mean > 0 ? Math.round((100 * sd) / mean) : null;
  const inRange = vals.filter((v) => v >= 70 && v <= 180).length;
  const above = vals.filter((v) => v > 180).length;
  const below = vals.filter((v) => v < 70).length;
  const highest = Math.max(...vals);
  const lowest = Math.min(...vals);
  // eA1C via GMI: 3.31 + 0.02392 * mean(mg/dL)
  const gmi = Math.round((3.31 + 0.02392 * mean) * 10) / 10;
  return {
    n: vals.length,
    avg: Math.round(mean),
    sd: Math.round(sd),
    cv_pct: cv,
    tir_pct: Math.round((100 * inRange) / vals.length),
    tar_pct: Math.round((100 * above) / vals.length),
    tbr_pct: Math.round((100 * below) / vals.length),
    highest: Math.round(highest),
    lowest: Math.round(lowest),
    estimated_a1c_gmi: gmi,
  };
}

/**
 * Scan yesterday's CGM for rapid rises (>=25 mg/dL over any 45-min window).
 * Any rise whose start has no food log within the prior 90 minutes is
 * flagged as a probable missed meal event.
 */
function detectMissedMeals(readings: Reading[], foods: FoodRow[]) {
  const out: { at: string; baseline: number; peak: number; rise: number }[] = [];
  if (readings.length < 6) return out;
  const foodTimes = foods.map((f) => new Date(f.logged_at).getTime()).sort((a, b) => a - b);
  const win = 45 * 60 * 1000;
  const lookback = 90 * 60 * 1000;
  let lastFlagged = 0;
  for (let i = 0; i < readings.length; i++) {
    const start = new Date(readings[i].ts).getTime();
    if (start - lastFlagged < 2 * 60 * 60 * 1000) continue; // dedupe within 2h
    let peakVal = Number(readings[i].mg_dl);
    let peakAt = start;
    for (let j = i + 1; j < readings.length; j++) {
      const t = new Date(readings[j].ts).getTime();
      if (t - start > win) break;
      const v = Number(readings[j].mg_dl);
      if (v > peakVal) { peakVal = v; peakAt = t; }
    }
    const rise = peakVal - Number(readings[i].mg_dl);
    if (rise >= 25) {
      const hasFood = foodTimes.some((ft) => Math.abs(ft - start) <= lookback && ft <= peakAt);
      if (!hasFood) {
        out.push({
          at: new Date(start).toISOString(),
          baseline: Math.round(Number(readings[i].mg_dl)),
          peak: Math.round(peakVal),
          rise: Math.round(rise),
        });
        lastFlagged = start;
      }
    }
  }
  return out;
}

function medAdherence(meds: MedRow[], events: MedEvRow[]) {
  const scheduled = meds.filter((m) => !!m.schedule_cron);
  const taken = new Set(events.map((e) => e.medication_id));
  return {
    prescribed: meds.length,
    scheduled: scheduled.length,
    taken_today: scheduled.filter((m) => taken.has(m.id)).length,
  };
}

async function callLLM(context: unknown, lovableKey: string) {
  const sys = [
    "You are the Calm Glucose Digital Twin coach for adults with type 2 diabetes.",
    "You MUST personalize every sentence using the JSON CONTEXT below. Do NOT give generic advice.",
    "Cite the user's own numbers (yesterday's TIR/avg/peak, meal timing, medications, prior-week comparison) whenever present.",
    "Rules: warm plain English, 6th-grade reading level; never prescribe doses; never give clinical targets; frame predictions as estimates; always defer to the user's care team.",
    "Return STRICT JSON only, no markdown, matching:",
    "{",
    '  "narrative": "3-5 sentences summarising yesterday, referencing yesterday_metrics and prior_week when possible",',
    '  "recommendations": [ { "title": "short action", "why": "explain using the user\'s own history", "expected_change_mg_dl": number|null, "confidence_pct": number, "difficulty": "easy"|"moderate"|"harder" } ],',
    '  "factors_used": ["short strings naming which CONTEXT fields shaped the answer"]',
    "}",
    "Return 2-5 recommendations ranked by expected_change_mg_dl (largest safe reduction first).",
  ].join(" ");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: "CONTEXT:\n" + JSON.stringify(context) },
      ],
    }),
  });
  if (!res.ok) {
    console.error("insights AI non-ok", res.status, await res.text());
    return null;
  }
  const j = await res.json();
  const txt: string = j?.choices?.[0]?.message?.content ?? "";
  try { return JSON.parse(txt); } catch { return { narrative: txt.trim() }; }
}

async function generateForUser(admin: ReturnType<typeof createClient>, userId: string, targetDate: Date): Promise<{ ok: boolean; skipped?: string; insight_id?: string }> {
  const dateStr = ymd(targetDate);
  const dayStart = new Date(`${dateStr}T00:00:00Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekAgoStart = new Date(dayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Skip if already generated
  const existing = await admin
    .from("daily_insights")
    .select("id")
    .eq("user_id", userId)
    .eq("insight_date", dateStr)
    .maybeSingle();
  if (existing.data) return { ok: true, skipped: "exists", insight_id: (existing.data as { id: string }).id };

  const [cgmRes, cgmPrevRes, foodRes, medEvRes, medsRes, twinRes] = await Promise.all([
    admin.from("cgm_readings").select("ts,mg_dl").eq("user_id", userId).gte("ts", dayStart.toISOString()).lt("ts", dayEnd.toISOString()).order("ts", { ascending: true }),
    admin.from("cgm_readings").select("ts,mg_dl").eq("user_id", userId).gte("ts", weekAgoStart.toISOString()).lt("ts", dayStart.toISOString()),
    admin.from("food_logs").select("id,label,type,carbs_grams,portion_size,logged_at").eq("user_id", userId).gte("logged_at", dayStart.toISOString()).lt("logged_at", dayEnd.toISOString()).order("logged_at", { ascending: true }),
    admin.from("medication_events").select("medication_id,taken_at").eq("user_id", userId).gte("taken_at", dayStart.toISOString()).lt("taken_at", dayEnd.toISOString()),
    admin.from("medications").select("id,name,med_class,schedule_cron").eq("user_id", userId),
    admin.from("twin_states").select("params").eq("user_id", userId).order("calibrated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const cgm = (cgmRes.data ?? []) as Reading[];
  const cgmPrev = (cgmPrevRes.data ?? []) as Reading[];
  const foods = (foodRes.data ?? []) as FoodRow[];
  const medEvents = (medEvRes.data ?? []) as MedEvRow[];
  const meds = (medsRes.data ?? []) as MedRow[];

  const metrics = computeMetrics(cgm);
  const prior = computeMetrics(cgmPrev);
  const missed = detectMissedMeals(cgm, foods);
  const adherence = medAdherence(meds, medEvents);

  const dataSufficiency: "full" | "partial" | "sparse" =
    metrics && metrics.n > 200 && foods.length > 0 ? "full" : metrics && metrics.n > 50 ? "partial" : "sparse";

  // Meal summary
  const mealsByHour = foods.map((f) => ({
    label: f.label,
    type: f.type,
    carbs: f.carbs_grams,
    portion: f.portion_size,
    hour: new Date(f.logged_at).getUTCHours(),
  }));

  const context = {
    date: dateStr,
    yesterday_metrics: metrics,
    prior_7d_metrics: prior,
    meals: mealsByHour,
    medications: {
      prescribed: meds.map((m) => ({ name: m.name, class: m.med_class })),
      adherence_summary: adherence,
    },
    missed_meal_candidates: missed,
    twin_params: twinRes.data?.params ?? null,
    data_sufficiency: dataSufficiency,
  };

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  let narrative = "";
  let recommendations: unknown[] = [];
  let factors: string[] = [];

  if (lovableKey && dataSufficiency !== "sparse") {
    const ai = await callLLM(context, lovableKey);
    if (ai) {
      narrative = typeof ai.narrative === "string" ? ai.narrative : "";
      recommendations = Array.isArray(ai.recommendations) ? ai.recommendations.slice(0, 5) : [];
      factors = Array.isArray(ai.factors_used) ? ai.factors_used.slice(0, 8) : [];
    }
  }

  // Deterministic fallback narrative — still personalized from computed metrics
  if (!narrative) {
    const bits: string[] = [];
    if (metrics) {
      bits.push(`Yesterday you spent ${metrics.tir_pct}% of the day in range (70–180 mg/dL), averaging ${metrics.avg} mg/dL.`);
      bits.push(`Your highest reading was ${metrics.highest} and lowest ${metrics.lowest}, with a variability of ${metrics.cv_pct}%.`);
      if (prior) {
        const diff = metrics.tir_pct - prior.tir_pct;
        if (Math.abs(diff) >= 3) bits.push(`That's ${diff > 0 ? "up" : "down"} ${Math.abs(diff)} percentage points compared with your last 7 days.`);
      }
    } else {
      bits.push("We don't have enough CGM data from yesterday to build a full picture. Connecting T1Pal or wearing your sensor consistently will let us coach you better.");
    }
    if (foods.length > 0) bits.push(`You logged ${foods.length} meal or drink${foods.length === 1 ? "" : "s"} yesterday.`);
    if (missed.length > 0) bits.push(`We noticed ${missed.length} unexplained glucose rise${missed.length === 1 ? "" : "s"} that may indicate an unlogged meal.`);
    bits.push("This is an estimate — your care team's guidance always comes first.");
    narrative = bits.join(" ");
    factors = [
      metrics ? "Yesterday's CGM readings" : "Missing CGM data",
      foods.length > 0 ? "Food logs" : "No food logs yesterday",
      meds.length > 0 ? "Medication list" : "No medications on file",
      missed.length > 0 ? "Missed-meal detection" : "No missed meals detected",
    ];
  }

  const { data: ins, error } = await admin
    .from("daily_insights")
    .insert({
      user_id: userId,
      insight_date: dateStr,
      metrics: metrics ?? {},
      narrative,
      recommendations,
      factors_used: factors,
      missed_events: missed,
      data_sufficiency: dataSufficiency,
      model_version: MODEL_VERSION,
    })
    .select("id")
    .single();

  if (error) {
    console.error("insight insert failed", error);
    return { ok: false };
  }
  return { ok: true, insight_id: (ins as { id: string }).id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const mode = body?.mode ?? "mine";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    if (mode === "cron") {
      // Cron: iterate users whose insight hour == current UTC hour.
      const nowHour = new Date().getUTCHours();
      const prefs = await admin
        .from("notification_prefs")
        .select("user_id,daily_insight_enabled,daily_insight_hour")
        .eq("daily_insight_enabled", true)
        .eq("daily_insight_hour", nowHour);

      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      const results: { user_id: string; ok: boolean; skipped?: string }[] = [];
      for (const p of ((prefs.data ?? []) as { user_id: string }[])) {
        const r = await generateForUser(admin, p.user_id, yesterday);
        results.push({ user_id: p.user_id, ...r });
      }
      return new Response(JSON.stringify({ mode: "cron", hour_utc: nowHour, processed: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // "mine" — authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const target = body?.date ? new Date(`${body.date}T00:00:00Z`) : (() => {
      const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d;
    })();
    const r = await generateForUser(admin, userData.user.id, target);
    // Return the row so the client can render immediately.
    const row = await admin
      .from("daily_insights")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("insight_date", ymd(target))
      .maybeSingle();
    return new Response(JSON.stringify({ ...r, insight: row.data ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-daily-insights error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
