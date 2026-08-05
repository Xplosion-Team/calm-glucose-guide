import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EntryType = "food" | "drink" | "med";
export type Source = "manual" | "photo" | "text" | "voice" | "sms";
export type PortionSize = "small" | "medium" | "large";

export interface FoodLog {
  id: string;
  type: EntryType;
  label: string;
  carbs_grams: number | null;
  portion_size: PortionSize | null;
  source: Source;
  logged_at: string;
  is_favorite?: boolean;
  image_url?: string | null;
  notes?: string | null;
}

export interface NewLog {
  type: EntryType;
  label: string;
  carbsGrams?: number;
  portionSize?: PortionSize;
  source?: Source;
  imageUrl?: string;
  loggedAt?: string;
}

async function triggerMealAnalysis(foodLogId: string) {
  try {
    // Fire-and-forget; analysis happens in background so logging feels instant.
    await supabase.functions.invoke("analyze-meal-response", {
      body: { food_log_id: foodLogId },
    });
  } catch (e) {
    // Non-fatal — logging must not fail if analysis errors.
    console.warn("meal analysis failed", e);
  }
}

export function useFoodLogs() {
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLogs([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("food_logs")
      .select("*")
      .order("logged_at", { ascending: false })
      .limit(500);
    if (!error && data) setLogs(data as FoodLog[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addLog = useCallback(
    async (entry: NewLog) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;
      const payload: Record<string, unknown> = {
        user_id: session.user.id,
        type: entry.type,
        label: entry.label,
        carbs_grams: entry.carbsGrams ?? null,
        portion_size: entry.portionSize ?? null,
        source: entry.source ?? "manual",
      };
      if (entry.imageUrl) payload.image_url = entry.imageUrl;
      if (entry.loggedAt) payload.logged_at = entry.loggedAt;
      const { data, error } = await supabase
        .from("food_logs")
        .insert(payload as never)
        .select()
        .single();
      if (error) {
        console.error("Insert log failed", error);
        return null;
      }
      const saved = data as FoodLog;
      setLogs((prev) => [saved, ...prev]);
      if (saved.type === "food" || saved.type === "drink") {
        // Background analysis — don't await
        void triggerMealAnalysis(saved.id);
      }
      return saved;
    },
    [],
  );

  const updateLog = useCallback(async (id: string, patch: {
    label?: string;
    carbsGrams?: number | null;
    portionSize?: PortionSize | null;
    loggedAt?: string;
    notes?: string | null;
  }) => {
    const payload: Record<string, unknown> = {};
    if (patch.label !== undefined) payload.label = patch.label;
    if (patch.carbsGrams !== undefined) payload.carbs_grams = patch.carbsGrams;
    if (patch.portionSize !== undefined) payload.portion_size = patch.portionSize;
    if (patch.loggedAt !== undefined) payload.logged_at = patch.loggedAt;
    if (patch.notes !== undefined) payload.notes = patch.notes;
    if (Object.keys(payload).length === 0) return null;

    const { data, error } = await supabase
      .from("food_logs")
      .update(payload as never)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      console.error("Update log failed", error);
      return null;
    }
    const saved = data as FoodLog;
    setLogs((prev) =>
      prev
        .map((l) => (l.id === id ? saved : l))
        .sort((a, b) => (a.logged_at < b.logged_at ? 1 : -1)),
    );
    // Time or carbs changed -> glucose response window changed, recompute in background.
    if ((saved.type === "food" || saved.type === "drink") && (patch.loggedAt || patch.carbsGrams !== undefined)) {
      void triggerMealAnalysis(saved.id);
    }
    return saved;
  }, []);

  const deleteLog = useCallback(async (id: string) => {
    const { error } = await supabase.from("food_logs").delete().eq("id", id);
    if (!error) setLogs((prev) => prev.filter((l) => l.id !== id));
  }, []);


  const toggleFavorite = useCallback(async (id: string) => {
    setLogs((prev) => prev.map((l) => l.id === id ? { ...l, is_favorite: !l.is_favorite } : l));
    const current = logs.find((l) => l.id === id);
    const next = !(current?.is_favorite ?? false);
    const { error } = await supabase
      .from("food_logs")
      .update({ is_favorite: next } as never)
      .eq("id", id);
    if (error) {
      // revert on failure
      setLogs((prev) => prev.map((l) => l.id === id ? { ...l, is_favorite: !next } : l));
    }
  }, [logs]);

  return { logs, loading, addLog, deleteLog, refresh, toggleFavorite };
}
