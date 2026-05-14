// Predict-meal edge function — Phase 1 stub of the personalized T2D postprandial twin.
// Persists a meal_log + a prediction row, returns the predicted curve and insight.
//
// This is a *population baseline* twin: a closed-form, monotonic post-meal response
// (Bateman-style absorption + first-order clearance) modulated by carbs and a small
// number of context factors. Personalization (Phase 2) will swap the params with
// per-patient values from twin_states.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL_VERSION = "twin-baseline-2026.05.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
  current_glucose_mg_dl?: number;
  horizon_min?: number;
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function predictCurve(opts: {
  baseline: number;
  carbs_g: number;
  fat_g: number;
  protein_g: number;
  fiber_g: number;
  horizon_min: number;
  // Context modifiers (population priors)
  insulin_sensitivity: number; // S_I, ~1.0
  beta_responsivity: number;   // Φ, ~1.0
}) {
  const {
    baseline, carbs_g, fat_g, protein_g, fiber_g,
    horizon_min, insulin_sensitivity, beta_responsivity,
  } = opts;

  // Effective carbs reduced by fiber and slightly delayed by fat/protein.
  const eff_carbs = Math.max(0, carbs_g - 0.5 * fiber_g);
  const delay_min = 5 + 0.4 * fat_g + 0.2 * protein_g; // up to ~30min delay
  const k_abs = 1 / 35;   // gut absorption rate (1/min) — peak around 60-80min
  const k_clr = 1 / 90;   // clearance rate (1/min) — back to baseline by ~3-4h

  // Per-gram glucose "rise potential" before insulin response (~1.6 mg/dL/g),
  // attenuated by personal sensitivity and beta-cell responsivity.
  const rise_per_g = 1.6 / (0.5 * insulin_sensitivity + 0.5 * beta_responsivity);
  const peak_potential = eff_carbs * rise_per_g;

  const curve: { t_min: number; mg_dl: number; lo: number; hi: number }[] = [];
  for (let t = 0; t <= horizon_min; t += 5) {
    const td = Math.max(0, t - delay_min);
    // Bateman-like: (k_abs/(k_abs-k_clr)) * (e^-k_clr*t - e^-k_abs*t)
    const ka = k_abs, ke = k_clr;
    const rise =
      peak_potential *
      (ka / (ka - ke)) *
      (Math.exp(-ke * td) - Math.exp(-ka * td));
    const mg = baseline + Math.max(0, rise);
    // Uncertainty grows over the horizon, ±5 to ±25 mg/dL
    const sigma = 5 + (20 * t) / horizon_min;
    curve.push({
      t_min: t,
      mg_dl: Math.round(mg * 10) / 10,
      lo: Math.round((mg - sigma) * 10) / 10,
      hi: Math.round((mg + sigma) * 10) / 10,
    });
  }

  let peak = curve[0];
  for (const p of curve) if (p.mg_dl > peak.mg_dl) peak = p;

  // Time-in-range delta vs flat baseline assumption (very rough).
  const tir_delta_pct =
    Math.round(
      (-100 *
        curve.filter((p) => p.mg_dl > 180 || p.mg_dl < 70).length) /
        curve.length,
    ) / 10;

  // Confidence: high when carbs are modest and we have a baseline, lower when extreme.
  const confidence = Math.max(
    0.3,
    Math.min(0.95, 0.85 - Math.max(0, eff_carbs - 60) / 200),
  );

  return { curve, peak, tir_delta_pct, confidence };
}

function buildInsight(peakMg: number, ttpMin: number, label: string): string {
  if (peakMg < 140)
    return `This ${label} looks gentle on your glucose — likely peaking around ${Math.round(peakMg)} in about ${ttpMin} minutes.`;
  if (peakMg < 180)
    return `This ${label} should peak near ${Math.round(peakMg)} around ${ttpMin} minutes after eating, then settle.`;
  return `This ${label} may push your glucose up to about ${Math.round(peakMg)} near ${ttpMin} minutes. A short walk afterward often helps it come back down sooner.`;
}

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

    const body = (await req.json()) as PredictBody & {
      mode?: string;
      question?: string;
      category?: string;
      detail?: string;
    };

    // What-If narrative mode: no meal log, no prediction row — just a calm AI answer.
    if (body?.mode === "what_if" && body.question) {
      const baseline = body.current_glucose_mg_dl ?? 110;
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      let insight =
        "Small, steady choices usually make the biggest difference. Try this and notice how your body responds — your care team's guidance comes first.";

      if (lovableKey) {
        try {
          const sys =
            "You are Calm Glucose Guide, a warm, plain-English companion for adults living with type 2 diabetes. " +
            "Answer 'what if' questions in 2-3 short sentences. Be supportive, never clinical. " +
            "Do NOT give medical advice, doses, or specific glucose numbers as targets. " +
            "Mention that this is an estimate and to check with their care team for anything important.";
          const user = `Current glucose is roughly ${baseline} mg/dL. Question: ${body.question}`;
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: sys },
                { role: "user", content: user },
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
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!body?.meal?.label || typeof body.meal.carbs_g !== "number") {
      return new Response(JSON.stringify({ error: "meal.label and meal.carbs_g required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const horizon_min = body.horizon_min ?? 240;
    const baseline = body.current_glucose_mg_dl ?? 110;

    // 1. Insert the meal_log
    const { data: meal, error: mealErr } = await supabase
      .from("meal_logs")
      .insert({
        user_id: userId,
        label: body.meal.label,
        logged_at: body.meal.logged_at ?? new Date().toISOString(),
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

    // 2. Get latest twin_state (population baseline if none)
    const { data: twin } = await supabase
      .from("twin_states")
      .select("*")
      .eq("user_id", userId)
      .order("calibrated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const params = (twin?.params as { S_I?: number; Phi?: number } | null) ?? {};
    const insulin_sensitivity = params.S_I ?? 1.0;
    const beta_responsivity = params.Phi ?? 0.7; // T2D prior — reduced

    // 3. Predict
    const { curve, peak, tir_delta_pct, confidence } = predictCurve({
      baseline,
      carbs_g: body.meal.carbs_g,
      fat_g: body.meal.fat_g ?? 0,
      protein_g: body.meal.protein_g ?? 0,
      fiber_g: body.meal.fiber_g ?? 0,
      horizon_min,
      insulin_sensitivity,
      beta_responsivity,
    });

    const inputs_snapshot = {
      meal: body.meal,
      baseline_mg_dl: baseline,
      horizon_min,
      params: { insulin_sensitivity, beta_responsivity },
      twin_state_id: twin?.id ?? null,
    };
    const inputs_hash = await sha256(JSON.stringify(inputs_snapshot));
    const insight = buildInsight(peak.mg_dl, peak.t_min, body.meal.label);

    // 4. Persist prediction (append-only)
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
