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
}

export interface NewLog {
  type: EntryType;
  label: string;
  carbsGrams?: number;
  portionSize?: PortionSize;
  source?: Source;
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
      const payload = {
        user_id: session.user.id,
        type: entry.type,
        label: entry.label,
        carbs_grams: entry.carbsGrams ?? null,
        portion_size: entry.portionSize ?? null,
        source: entry.source ?? "manual",
      };
      const { data, error } = await supabase
        .from("food_logs")
        .insert(payload)
        .select()
        .single();
      if (error) {
        console.error("Insert log failed", error);
        return null;
      }
      setLogs((prev) => [data as FoodLog, ...prev]);
      return data as FoodLog;
    },
    [],
  );

  const deleteLog = useCallback(async (id: string) => {
    const { error } = await supabase.from("food_logs").delete().eq("id", id);
    if (!error) setLogs((prev) => prev.filter((l) => l.id !== id));
  }, []);

  return { logs, loading, addLog, deleteLog, refresh };
}
