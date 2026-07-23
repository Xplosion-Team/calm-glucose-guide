import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNotificationPrefs } from "./useNotificationPrefs";

export interface PendingSpike {
  id: string;
  detected_at: string;
  baseline_mg_dl: number;
  peak_mg_dl: number;
  rise_mg_dl: number;
  window_min: number;
}

// Thresholds by sensitivity — (rise_mg_dl, window_minutes)
const THRESHOLDS: Record<"low" | "medium" | "high", { rise: number; window: number }> = {
  low: { rise: 45, window: 45 },
  medium: { rise: 30, window: 45 },
  high: { rise: 20, window: 60 },
};

function inQuietHours(prefs: { quiet_start_hour: number | null; quiet_end_hour: number | null }): boolean {
  const s = prefs.quiet_start_hour, e = prefs.quiet_end_hour;
  if (s == null || e == null) return false;
  const h = new Date().getHours();
  return s < e ? h >= s && h < e : h >= s || h < e;
}

/**
 * Client-side rapid-rise detector. Runs whenever the user opens/refreshes:
 * pulls the last 2h of CGM readings + the last 90m of food logs, checks the
 * user's sensitivity threshold, and — if a spike with no matching food log is
 * found — inserts a spike_events row (deduped for 2h) and surfaces it.
 */
export function useSpikeDetection(refreshKey?: unknown) {
  const { prefs, loaded } = useNotificationPrefs();
  const [pending, setPending] = useState<PendingSpike | null>(null);
  const dismissed = useRef<Set<string>>(new Set());

  const scan = useCallback(async () => {
    if (!loaded || !prefs.spike_enabled) return;
    if (inQuietHours(prefs)) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    const now = Date.now();
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    const ninetyMinAgo = new Date(now - 90 * 60 * 1000).toISOString();

    // Bail early if we've already surfaced a spike in the last 2h (any response).
    const { data: recentSpike } = await supabase
      .from("spike_events")
      .select("id,detected_at,user_response")
      .eq("user_id", u.user.id)
      .gte("detected_at", twoHoursAgo)
      .order("detected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recentSpike && (recentSpike as { user_response: string }).user_response !== "pending") return;
    if (recentSpike && (recentSpike as { user_response: string }).user_response === "pending") {
      const r = recentSpike as PendingSpike & { user_response: string };
      if (!dismissed.current.has(r.id)) {
        setPending({
          id: r.id,
          detected_at: r.detected_at,
          baseline_mg_dl: r.baseline_mg_dl,
          peak_mg_dl: r.peak_mg_dl,
          rise_mg_dl: r.rise_mg_dl,
          window_min: r.window_min,
        });
      }
      return;
    }

    const { rise, window } = THRESHOLDS[prefs.spike_sensitivity];

    const { data: readings } = await supabase
      .from("cgm_readings")
      .select("ts,mg_dl")
      .eq("user_id", u.user.id)
      .gte("ts", twoHoursAgo)
      .order("ts", { ascending: true });

    const rows = (readings ?? []) as { ts: string; mg_dl: number }[];
    if (rows.length < 3) return;

    // Scan every reading as a potential start point; require a rise of >= threshold
    // within `window` minutes. Use the newest qualifying spike.
    let best: { i: number; j: number; rise: number } | null = null;
    for (let i = 0; i < rows.length - 1; i++) {
      const t0 = new Date(rows[i].ts).getTime();
      let peak = Number(rows[i].mg_dl);
      let jBest = i;
      for (let j = i + 1; j < rows.length; j++) {
        const dt = (new Date(rows[j].ts).getTime() - t0) / 60000;
        if (dt > window) break;
        if (Number(rows[j].mg_dl) > peak) { peak = Number(rows[j].mg_dl); jBest = j; }
      }
      const diff = peak - Number(rows[i].mg_dl);
      if (diff >= rise && (!best || new Date(rows[i].ts).getTime() > new Date(rows[best.i].ts).getTime())) {
        best = { i, j: jBest, rise: diff };
      }
    }
    if (!best) return;

    // Adaptive: reduce false positives — if last 6h SD is very large, require +25%
    const sixHrAgo = new Date(now - 6 * 60 * 60 * 1000).toISOString();
    const { data: recent6h } = await supabase
      .from("cgm_readings")
      .select("mg_dl")
      .eq("user_id", u.user.id)
      .gte("ts", sixHrAgo);
    const vals = (recent6h ?? []).map((r: { mg_dl: number }) => Number(r.mg_dl));
    if (vals.length > 5) {
      const mean = vals.reduce((a, v) => a + v, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length);
      const need = rise + Math.max(0, (sd - 30) * 0.5);
      if (best.rise < need) return;
    }

    // Check for food log within 90m of the rise start.
    const startTs = rows[best.i].ts;
    const { data: recentFood } = await supabase
      .from("food_logs")
      .select("id,logged_at")
      .eq("user_id", u.user.id)
      .gte("logged_at", ninetyMinAgo)
      .order("logged_at", { ascending: false });

    const foodTimes = (recentFood ?? []) as { id: string; logged_at: string }[];
    const startMs = new Date(startTs).getTime();
    const matched = foodTimes.find((f) => Math.abs(new Date(f.logged_at).getTime() - startMs) <= 90 * 60 * 1000);

    const baseline = Number(rows[best.i].mg_dl);
    const peakVal = Number(rows[best.j].mg_dl);
    const winMin = Math.round((new Date(rows[best.j].ts).getTime() - startMs) / 60000);

    if (matched) {
      // Auto-match: still record for learning, but don't disturb the user.
      await supabase.from("spike_events").insert({
        user_id: u.user.id,
        detected_at: startTs,
        baseline_mg_dl: baseline,
        peak_mg_dl: peakVal,
        rise_mg_dl: peakVal - baseline,
        window_min: winMin,
        sensitivity: prefs.spike_sensitivity,
        associated_food_log_id: matched.id,
        user_response: "auto_matched",
        responded_at: new Date().toISOString(),
      });
      return;
    }

    const { data: inserted } = await supabase
      .from("spike_events")
      .insert({
        user_id: u.user.id,
        detected_at: startTs,
        baseline_mg_dl: baseline,
        peak_mg_dl: peakVal,
        rise_mg_dl: peakVal - baseline,
        window_min: winMin,
        sensitivity: prefs.spike_sensitivity,
      })
      .select("id,detected_at,baseline_mg_dl,peak_mg_dl,rise_mg_dl,window_min")
      .single();
    if (inserted && !dismissed.current.has((inserted as PendingSpike).id)) {
      setPending(inserted as PendingSpike);
    }
  }, [loaded, prefs]);

  useEffect(() => { scan(); }, [scan, refreshKey]);

  const respond = useCallback(async (response: "log_meal" | "log_drink" | "not_food" | "dismissed") => {
    if (!pending) return;
    dismissed.current.add(pending.id);
    await supabase
      .from("spike_events")
      .update({ user_response: response, responded_at: new Date().toISOString() })
      .eq("id", pending.id);
    setPending(null);
  }, [pending]);

  return { pending, respond, prefs };
}
