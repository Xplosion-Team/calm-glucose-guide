// predict-meal — personalized T2D postprandial twin.
//
// This is NOT a population-only baseline anymore. Every prediction must be built
// from the authenticated user's own:
//   1) T1Pal-synced CGM history (cgm_readings)  -> live baseline + recent trend
//   2) Medication profile (medications + medication_events) -> physiologic modifiers
//   3) Personal twin_state if previously calibrated
//
// If the required inputs are missing we DO NOT silently fall back to demo values.
// We compute a safe-but-degraded prediction and flag the missing inputs in the
// response so the UI can surface them and ask the user to connect data.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL_VERSION = "twin-personalized-2026.06.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ----- Types -----
type MedClass =
  | "rapid_insulin"
  | "long_insulin"
  | "sulfonylurea"
  | "metformin"
  | "glp1"
  | "sglt2"
  | "dpp4"
  | "other";

interface PredictBody {
  meal: {
    label: string;
    logged_at?: string;
    carbs_g: number;
    fat_g?: number;
    protein_g?: number;
    fiber_g?: number;
    portion_size?: "small" | "medium" | "large" | null;
    source?: string;
    image_url?: string;
    raw_ai?: unknown;
  };
  current_glucose_mg_dl?: number; // optional client override; CGM wins if present
  horizon_min?: number;
  mode?: string;
  question?: string;
}

interface CgmReading { ts: string; mg_dl: number; trend?: string | null; source?: string | null }
interface MedicationRow {
  id: string;
  name: string;
  med_class: MedClass;
  dose: number | null;
  unit: string | null;
  schedule_cron: string | null;
  started_at: string;
  stopped_at: string | null;
}
interface MedEventRow {
  medication_id: string;
  taken_at: string;
  dose: number | null;
}

// ----- Utilities -----
async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function minutesBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 60000;
}

// ----- CGM summary -----
interface CgmSummary {
  baseline_mg_dl: number;        // best estimate of current glucose
  trend_mg_dl_per_min: number;   // recent slope
  variability_sd: number;        // recent SD as a personalization cue
  last_reading_age_min: number | null;
  readings_used: number;
  source: "t1pal" | "client_override" | "none";
}

function summarizeCgm(readings: CgmReading[], now: Date, clientOverride?: number): CgmSummary {
  if (readings.length === 0) {
    if (typeof clientOverride === "number") {
      return {
        baseline_mg_dl: clientOverride,
        trend_mg_dl_per_min: 0,
        variability_sd: 0,
        last_reading_age_min: null,
        readings_used: 0,
        source: "client_override",
      };
    }
    return {
      baseline_mg_dl: 120, // safe-but-conservative T2D pre-meal placeholder for math only
      trend_mg_dl_per_min: 0,
      variability_sd: 0,
      last_reading_age_min: null,
      readings_used: 0,
      source: "none",
    };
  }

  // Readings are ascending by ts. Use the last 6h for variability, last 30m for trend.
  const last = readings[readings.length - 1];
  const lastTs = new Date(last.ts);
  const lastAge = minutesBetween(now, lastTs);

  const recent = readings.filter((r) => minutesBetween(lastTs, new Date(r.ts)) <= 30);
  let trend = 0;
  if (recent.length >= 2) {
    const first = recent[0];
    const dtMin = minutesBetween(new Date(last.ts), new Date(first.ts));
    if (dtMin > 0) trend = (Number(last.mg_dl) - Number(first.mg_dl)) / dtMin;
  }

  const sixHour = readings.filter((r) => minutesBetween(lastTs, new Date(r.ts)) <= 360);
  const mean = sixHour.reduce((a, r) => a + Number(r.mg_dl), 0) / sixHour.length;
  const variance =
    sixHour.reduce((a, r) => a + Math.pow(Number(r.mg_dl) - mean, 2), 0) /
    Math.max(1, sixHour.length - 1);
  const sd = Math.sqrt(variance);

  // Project the most recent reading forward by its age so baseline reflects "now".
  // Cap projection at 10 minutes of trend to avoid runaway extrapolation.
  const projMin = Math.min(Math.max(lastAge, 0), 10);
  const baseline = Math.max(40, Math.min(400, Number(last.mg_dl) + trend * projMin));

  return {
    baseline_mg_dl: Math.round(baseline * 10) / 10,
    trend_mg_dl_per_min: Math.round(trend * 1000) / 1000,
    variability_sd: Math.round(sd * 10) / 10,
    last_reading_age_min: Math.round(lastAge),
    readings_used: readings.length,
    source: "t1pal",
  };
}

// ----- Medication effects -----
interface MedEffect {
  // Multipliers applied to the raw post-meal rise.
  rise_multiplier: number;       // 1.0 = no change. <1 lowers peak.
  absorption_multiplier: number; // <1 slows gut absorption (lower, later peak).
  baseline_shift_mg_dl: number;  // additive shift to fasting baseline expectation.
  hypo_risk_boost: boolean;
  reasons: string[];             // human-readable contributions
  active_medications: {
    name: string;
    med_class: MedClass;
    dose: number | null;
    taken_minutes_ago: number | null;
    on_board: boolean;
  }[];
}

const DURATION_MIN: Record<MedClass, number> = {
  rapid_insulin: 240,
  sulfonylurea: 360,
  long_insulin: 24 * 60,
  metformin: 12 * 60,
  glp1: 7 * 24 * 60, // long-acting GLP-1 weekly agents
  sglt2: 24 * 60,
  dpp4: 24 * 60,
  other: 240,
};

function assessMedicationEffect(
  meds: MedicationRow[],
  events: MedEventRow[],
  now: Date,
): MedEffect {
  const reasons: string[] = [];
  const active: MedEffect["active_medications"] = [];
  let rise = 1.0;
  let absorb = 1.0;
  let baselineShift = 0;
  let hypoBoost = false;

  // Filter to currently-prescribed meds (not stopped).
  const current = meds.filter((m) => !m.stopped_at || new Date(m.stopped_at) > now);

  // Map most recent event per medication
  const latestEvent = new Map<string, MedEventRow>();
  for (const ev of events) {
    const prev = latestEvent.get(ev.medication_id);
    if (!prev || new Date(ev.taken_at) > new Date(prev.taken_at)) {
      latestEvent.set(ev.medication_id, ev);
    }
  }

  for (const m of current) {
    const ev = latestEvent.get(m.id);
    const ageMin = ev ? minutesBetween(now, new Date(ev.taken_at)) : null;
    const dur = DURATION_MIN[m.med_class] ?? 240;
    // "On board" if a dose was taken within its action duration, OR
    // for chronic baseline agents (metformin/glp1/sglt2/dpp4/long_insulin) assume
    // active if prescribed even without a same-day event (typical for daily/weekly).
    const chronicBaseline: MedClass[] = ["metformin", "glp1", "sglt2", "dpp4", "long_insulin"];
    const onBoard = ageMin != null ? ageMin <= dur : chronicBaseline.includes(m.med_class);

    active.push({
      name: m.name,
      med_class: m.med_class,
      dose: m.dose,
      taken_minutes_ago: ageMin != null ? Math.round(ageMin) : null,
      on_board: onBoard,
    });

    if (!onBoard) continue;

    switch (m.med_class) {
      case "rapid_insulin": {
        // Recently dosed rapid insulin strongly blunts the meal rise.
        const within = ageMin != null && ageMin <= 180;
        rise *= within ? 0.45 : 0.85;
        if (ageMin != null && ageMin >= 30 && ageMin <= 180) hypoBoost = true;
        reasons.push(`Rapid-acting insulin (${m.name}) is on board and will blunt the post-meal rise.`);
        break;
      }
      case "sulfonylurea": {
        rise *= 0.8;
        baselineShift -= 5;
        if (ageMin != null && ageMin >= 30 && ageMin <= 240) hypoBoost = true;
        reasons.push(`${m.name} (sulfonylurea) increases your own insulin response.`);
        break;
      }
      case "long_insulin":
        baselineShift -= 8;
        reasons.push(`${m.name} (long-acting insulin) is providing background coverage.`);
        break;
      case "metformin":
        rise *= 0.9;
        baselineShift -= 5;
        reasons.push(`Metformin is reducing background glucose production.`);
        break;
      case "glp1":
        rise *= 0.75;
        absorb *= 0.7; // delays gastric emptying — flatter, later peak
        baselineShift -= 6;
        reasons.push(`${m.name} (GLP-1) slows digestion and lowers the meal peak.`);
        break;
      case "sglt2":
        baselineShift -= 10;
        reasons.push(`${m.name} (SGLT2) helps clear glucose through the kidneys.`);
        break;
      case "dpp4":
        rise *= 0.92;
        reasons.push(`${m.name} (DPP-4) gently supports your insulin response after meals.`);
        break;
      case "other":
        reasons.push(`${m.name} is part of your routine.`);
        break;
    }
  }

  return {
    rise_multiplier: Math.max(0.1, rise),
    absorption_multiplier: Math.max(0.3, absorb),
    baseline_shift_mg_dl: baselineShift,
    hypo_risk_boost: hypoBoost,
    reasons,
    active_medications: active,
  };
}

// ----- Curve generation -----
interface PredictArgs {
  baseline: number;
  trend_mg_dl_per_min: number;
  variability_sd: number;
  carbs_g: number;
  fat_g: number;
  protein_g: number;
  fiber_g: number;
  horizon_min: number;
  insulin_sensitivity: number;
  beta_responsivity: number;
  med: MedEffect;
}

function predictCurve(a: PredictArgs) {
  const eff_carbs = Math.max(0, a.carbs_g - 0.5 * a.fiber_g);
  const delay_min = 5 + 0.4 * a.fat_g + 0.2 * a.protein_g;

  // Base rates, modulated by GLP-1-style absorption slowing.
  const k_abs = (1 / 35) * a.med.absorption_multiplier;
  const k_clr = 1 / 90;

  const rise_per_g = 1.6 / (0.5 * a.insulin_sensitivity + 0.5 * a.beta_responsivity);
  const peak_potential = eff_carbs * rise_per_g * a.med.rise_multiplier;

  // Uncertainty scales with the user's own CGM variability when we have it.
  const baseSigma = 4 + Math.min(12, a.variability_sd * 0.4);

  const curve: { t_min: number; mg_dl: number; lo: number; hi: number }[] = [];
  for (let t = 0; t <= a.horizon_min; t += 5) {
    const td = Math.max(0, t - delay_min);
    const ka = k_abs, ke = k_clr;
    const meal_rise =
      peak_potential * (ka / (ka - ke)) * (Math.exp(-ke * td) - Math.exp(-ka * td));
    // Carry the recent trend forward briefly, decaying over ~30min.
    const trendCarry = a.trend_mg_dl_per_min * t * Math.exp(-t / 30);
    const mg = a.baseline + a.med.baseline_shift_mg_dl + Math.max(0, meal_rise) + trendCarry;
    const sigma = baseSigma + (15 * t) / a.horizon_min;
    curve.push({
      t_min: t,
      mg_dl: Math.round(mg * 10) / 10,
      lo: Math.round((mg - sigma) * 10) / 10,
      hi: Math.round((mg + sigma) * 10) / 10,
    });
  }

  let peak = curve[0];
  for (const p of curve) if (p.mg_dl > peak.mg_dl) peak = p;

  const oor = curve.filter((p) => p.mg_dl > 180 || p.mg_dl < 70).length;
  const tir_delta_pct = Math.round((-100 * oor) / curve.length * 10) / 10;

  // Confidence: higher when we used CGM data, lower when we didn't.
  const cgmBoost = a.variability_sd > 0 ? 0.15 : -0.1;
  const confidence = Math.max(
    0.25,
    Math.min(0.95, 0.7 + cgmBoost - Math.max(0, eff_carbs - 60) / 250),
  );

  return { curve, peak, tir_delta_pct, confidence };
}

function buildInsight(peakMg: number, ttpMin: number, label: string, med: MedEffect): string {
  const tail = med.hypo_risk_boost
    ? " Keep a quick snack nearby — your medication can lower glucose in the next few hours."
    : "";
  if (peakMg < 140)
    return `This ${label} looks gentle on your glucose — likely peaking around ${Math.round(peakMg)} in about ${ttpMin} minutes.${tail}`;
  if (peakMg < 180)
    return `This ${label} should peak near ${Math.round(peakMg)} around ${ttpMin} minutes after eating, then settle.${tail}`;
  return `This ${label} may push your glucose up to about ${Math.round(peakMg)} near ${ttpMin} minutes. A short walk afterward often helps it come back down sooner.${tail}`;
}

// ----- Handler -----
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const body = (await req.json()) as PredictBody;
    const now = new Date();

    // ----- Shared context fetches (used by both modes) -----
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const [cgmRes, t1palRes, medsRes, medEventsRes, twinRes] = await Promise.all([
      supabase
        .from("cgm_readings")
        .select("ts,mg_dl,trend,source")
        .eq("user_id", userId)
        .gte("ts", sixHoursAgo)
        .order("ts", { ascending: true }),
      supabase
        .from("t1pal_connections")
        .select("status,last_sync_at,last_successful_reading_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("medications")
        .select("id,name,med_class,dose,unit,schedule_cron,started_at,stopped_at")
        .eq("user_id", userId),
      supabase
        .from("medication_events")
        .select("medication_id,taken_at,dose")
        .eq("user_id", userId)
        .gte("taken_at", twentyFourHoursAgo)
        .order("taken_at", { ascending: false }),
      supabase
        .from("twin_states")
        .select("*")
        .eq("user_id", userId)
        .order("calibrated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const cgm = (cgmRes.data ?? []) as CgmReading[];
    const meds = (medsRes.data ?? []) as MedicationRow[];
    const medEvents = (medEventsRes.data ?? []) as MedEventRow[];
    const twin = twinRes.data as { id: string; params: Record<string, unknown> } | null;

    const cgmSummary = summarizeCgm(cgm, now, body.current_glucose_mg_dl);
    const medEffect = assessMedicationEffect(meds, medEvents, now);

    // Personalization: prefer per-user twin_state params; else T2D priors.
    const params = (twin?.params ?? {}) as { S_I?: number; Phi?: number };
    const insulin_sensitivity = params.S_I ?? 1.0;
    const beta_responsivity = params.Phi ?? 0.7;

    const requiredInputsMissing: string[] = [];
    if (cgmSummary.source === "none") requiredInputsMissing.push("t1pal_glucose");
    if (meds.length === 0) requiredInputsMissing.push("medications");

    const dataSources = {
      cgm: cgmSummary,
      t1pal: t1palRes.data
        ? {
            status: (t1palRes.data as { status: string }).status,
            last_sync_at: (t1palRes.data as { last_sync_at: string | null }).last_sync_at,
            last_reading_at: (t1palRes.data as { last_successful_reading_at: string | null })
              .last_successful_reading_at,
          }
        : null,
      medications: {
        count_prescribed: meds.length,
        active: medEffect.active_medications,
        reasons: medEffect.reasons,
      },
      twin_state: twin ? { id: twin.id, params } : null,
      required_inputs_missing: requiredInputsMissing,
    };

    // ----- What-If narrative mode -----
    if (body?.mode === "what_if" && body.question) {
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      let insight =
        "Small, steady choices usually make the biggest difference. Try this and notice how your body responds — your care team's guidance comes first.";

      if (lovableKey) {
        try {
          const sys =
            "You are Calm Glucose Guide, a warm, plain-English companion for adults living with type 2 diabetes. " +
            "Answer 'what if' questions in 2-3 short sentences. Be supportive, never clinical. " +
            "Do NOT give medical advice, doses, or specific glucose targets. " +
            "Mention this is an estimate and to check with their care team for anything important.";
          const medSummary =
            medEffect.active_medications.filter((m) => m.on_board).map((m) => m.name).join(", ") || "none on board";
          const userPrompt =
            `Recent glucose ~${Math.round(cgmSummary.baseline_mg_dl)} mg/dL (` +
            `${cgmSummary.source === "t1pal" ? "from T1Pal CGM" : "no live CGM"}). ` +
            `Active medications: ${medSummary}. Question: ${body.question}`;
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: sys },
                { role: "user", content: userPrompt },
              ],
            }),
          });
          if (res.ok) {
            const j = await res.json();
            const txt = j?.choices?.[0]?.message?.content;
            if (typeof txt === "string" && txt.trim()) insight = txt.trim();
          } else {
            console.error("what_if AI non-ok", res.status, await res.text());
          }
        } catch (e) {
          console.error("what_if AI error", e);
        }
      }

      return new Response(
        JSON.stringify({
          mode: "what_if",
          question: body.question,
          insight_text: insight,
          model_version: MODEL_VERSION,
          data_sources: dataSources,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ----- Meal-prediction mode -----
    if (!body?.meal?.label || typeof body.meal.carbs_g !== "number") {
      return new Response(JSON.stringify({ error: "meal.label and meal.carbs_g required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const horizon_min = body.horizon_min ?? 240;

    const { data: meal, error: mealErr } = await supabase
      .from("meal_logs")
      .insert({
        user_id: userId,
        label: body.meal.label,
        logged_at: body.meal.logged_at ?? now.toISOString(),
        carbs_g: Math.round(body.meal.carbs_g),
        fat_g: body.meal.fat_g ?? null,
        protein_g: body.meal.protein_g ?? null,
        fiber_g: body.meal.fiber_g ?? null,
        portion_size: body.meal.portion_size ?? null,
        source: body.meal.source ?? "manual",
        image_url: body.meal.image_url ?? null,
        raw_ai: body.meal.raw_ai ?? null,
      })
      .select()
      .single();
    if (mealErr || !meal) {
      console.error("meal insert failed", mealErr);
      return new Response(JSON.stringify({ error: "meal insert failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { curve, peak, tir_delta_pct, confidence } = predictCurve({
      baseline: cgmSummary.baseline_mg_dl,
      trend_mg_dl_per_min: cgmSummary.trend_mg_dl_per_min,
      variability_sd: cgmSummary.variability_sd,
      carbs_g: body.meal.carbs_g,
      fat_g: body.meal.fat_g ?? 0,
      protein_g: body.meal.protein_g ?? 0,
      fiber_g: body.meal.fiber_g ?? 0,
      horizon_min,
      insulin_sensitivity,
      beta_responsivity,
      med: medEffect,
    });

    const inputs_snapshot = {
      meal: body.meal,
      cgm_summary: cgmSummary,
      medication_effect: medEffect,
      twin_state_id: twin?.id ?? null,
      params: { insulin_sensitivity, beta_responsivity },
      horizon_min,
      required_inputs_missing: requiredInputsMissing,
    };
    const inputs_hash = await sha256(JSON.stringify(inputs_snapshot));
    const insight = buildInsight(peak.mg_dl, peak.t_min, body.meal.label, medEffect);

    const { data: pred, error: predErr } = await supabase
      .from("predictions")
      .insert({
        user_id: userId,
        meal_log_id: meal.id,
        model_version: MODEL_VERSION,
        inputs_hash,
        horizon_min,
        peak_mg_dl: peak.mg_dl,
        time_to_peak_min: peak.t_min,
        tir_delta_pct,
        confidence,
        curve,
        insight_text: insight,
        inputs_snapshot,
      })
      .select()
      .single();
    if (predErr || !pred) {
      console.error("prediction insert failed", predErr);
      return new Response(JSON.stringify({ error: "prediction insert failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        prediction_id: pred.id,
        meal_log_id: meal.id,
        model_version: MODEL_VERSION,
        horizon_min,
        peak_mg_dl: peak.mg_dl,
        time_to_peak_min: peak.t_min,
        tir_delta_pct,
        confidence,
        curve,
        insight_text: insight,
        data_sources: dataSources,
        explanations: {
          baseline_from: cgmSummary.source,
          medication_reasons: medEffect.reasons,
          hypo_risk_boost: medEffect.hypo_risk_boost,
          required_inputs_missing: requiredInputsMissing,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("predict-meal error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
