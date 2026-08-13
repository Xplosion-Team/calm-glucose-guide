import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MealReminder {
  id: string;
  food_log_id: string;
  meal_label: string;
  due_at: string;
}

/**
 * Reads post-meal reminders that have come due. Rows are created by a database
 * trigger when a food/drink entry is saved, so the in-app card and the SMS
 * reminder always stay in sync.
 */
export function useMealReminders() {
  const [dueReminder, setDueReminder] = useState<MealReminder | null>(null);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setDueReminder(null);
      return;
    }
    const nowIso = new Date().toISOString();
    // Ignore anything older than 6 hours — a stale nudge isn't helpful.
    const cutoff = new Date(Date.now() - 6 * 3.6e6).toISOString();

    const { data } = await supabase
      .from("meal_reminders")
      .select("id, food_log_id, meal_label, due_at")
      .eq("status", "pending")
      .lte("due_at", nowIso)
      .gte("due_at", cutoff)
      .order("due_at", { ascending: true })
      .limit(1);

    setDueReminder((data?.[0] as MealReminder) ?? null);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const resolve = useCallback(
    async (id: string, status: "done" | "dismissed") => {
      setDueReminder((prev) => (prev?.id === id ? null : prev));
      await supabase
        .from("meal_reminders")
        .update({ status, responded_at: new Date().toISOString() })
        .eq("id", id);
      void refresh();
    },
    [refresh],
  );

  const snooze = useCallback(
    async (id: string, minutes = 30) => {
      setDueReminder(null);
      await supabase
        .from("meal_reminders")
        .update({ due_at: new Date(Date.now() + minutes * 60_000).toISOString() })
        .eq("id", id);
    },
    [],
  );

  return { dueReminder, refresh, resolve, snooze };
}
