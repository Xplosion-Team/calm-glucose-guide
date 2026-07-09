import { useMemo } from "react";
import { useFoodLogs, type FoodLog } from "@/hooks/useFoodLogs";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MealSummary {
  label: string;
  type: FoodLog["type"];
  count: number;
  lastLoggedAt: string;
  avgCarbs: number | null;
  lastLogId: string;
}

function summarize(logs: FoodLog[]): MealSummary[] {
  const map = new Map<string, MealSummary>();
  for (const log of logs) {
    if (log.type !== "food" && log.type !== "drink") continue;
    const key = `${log.type}::${log.label.trim().toLowerCase()}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        label: log.label,
        type: log.type,
        count: 1,
        lastLoggedAt: log.logged_at,
        avgCarbs: log.carbs_grams,
        lastLogId: log.id,
      });
    } else {
      existing.count += 1;
      if (new Date(log.logged_at) > new Date(existing.lastLoggedAt)) {
        existing.lastLoggedAt = log.logged_at;
        existing.lastLogId = log.id;
      }
      if (log.carbs_grams != null) {
        const prev = existing.avgCarbs ?? log.carbs_grams;
        existing.avgCarbs = Math.round((prev + log.carbs_grams) / 2);
      }
    }
  }
  return Array.from(map.values());
}

/** Returns up to 10 meals ranked by recency + frequency. */
export function useRecentMeals(limit = 10) {
  const { logs, loading } = useFoodLogs();
  const meals = useMemo(() => {
    const summarized = summarize(logs);
    const now = Date.now();
    return summarized
      .map((m) => {
        const ageDays = (now - new Date(m.lastLoggedAt).getTime()) / (1000 * 60 * 60 * 24);
        const score = m.count * 2 + Math.max(0, 30 - ageDays);
        return { ...m, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }, [logs, limit]);
  return { meals, loading };
}

export function useFavoriteMeals() {
  const { logs, loading, toggleFavorite } = useFoodLogs();
  const favorites = useMemo(() => {
    const favs = logs.filter((l) => l.is_favorite);
    return summarize(favs).sort((a, b) =>
      new Date(b.lastLoggedAt).getTime() - new Date(a.lastLoggedAt).getTime()
    );
  }, [logs]);
  return { favorites, loading, toggleFavorite };
}

export interface MealResponseRow {
  id: string;
  food_log_id: string;
  status: string;
  baseline_mg_dl: number | null;
  peak_mg_dl: number | null;
  glucose_rise: number | null;
  time_to_peak_min: number | null;
  recovery_time_min: number | null;
  avg_mg_dl: number | null;
  auc: number | null;
  time_above_range_min: number | null;
  meal_score: number | null;
  readings_count: number | null;
  computed_at: string;
}

/** Fetch meal response for a specific food log. */
export function useMealResponse(foodLogId: string | null) {
  const [data, setData] = useState<MealResponseRow | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!foodLogId) return;
    setLoading(true);
    const { data: row } = await supabase
      .from("meal_responses")
      .select("*")
      .eq("food_log_id", foodLogId)
      .maybeSingle();
    setData((row as MealResponseRow | null) ?? null);
    setLoading(false);
  }, [foodLogId]);

  useEffect(() => {
    void load();
  }, [load]);

  const recompute = useCallback(async () => {
    if (!foodLogId) return;
    setLoading(true);
    await supabase.functions.invoke("analyze-meal-response", { body: { food_log_id: foodLogId } });
    await load();
  }, [foodLogId, load]);

  return { data, loading, recompute, refresh: load };
}

/** Fetch all meal responses for the user (for insights). */
export function useAllMealResponses() {
  const [rows, setRows] = useState<MealResponseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setRows([]); setLoading(false); return; }
      const { data } = await supabase
        .from("meal_responses")
        .select("*")
        .eq("status", "ready")
        .order("computed_at", { ascending: false })
        .limit(500);
      if (!cancelled) {
        setRows((data as MealResponseRow[] | null) ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { rows, loading };
}

export function scoreBand(score: number | null | undefined):
  { label: string; emoji: string; className: string } | null {
  if (score == null) return null;
  if (score >= 80) return { label: "Excellent", emoji: "🟢", className: "text-status-stable bg-status-stable-bg" };
  if (score >= 60) return { label: "Good", emoji: "🟡", className: "text-amber-700 bg-amber-100" };
  if (score >= 40) return { label: "Moderate", emoji: "🟠", className: "text-orange-700 bg-orange-100" };
  return { label: "High Impact", emoji: "🔴", className: "text-status-rising bg-status-rising-bg" };
}
