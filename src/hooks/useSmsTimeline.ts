import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FoodLog } from "@/hooks/useFoodLogs";

export type PendingStatus = "pending" | "confirmed" | "discarded";

export interface InboundMessage {
  id: string;
  type: string;
  label: string;
  carbs_grams: number | null;
  portion_size: string | null;
  original_text: string;
  status: PendingStatus;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimelineItem {
  message: InboundMessage;
  /** The journal entry this text turned into, when it was confirmed. */
  log: FoodLog | null;
}

/**
 * A text only becomes a journal entry once the person replies YES, and the two
 * rows aren't linked by a foreign key — so we pair them here: for each
 * confirmed message, take the closest SMS-sourced log saved after it (same
 * label wins over pure proximity), and never reuse a log for two messages.
 */
function pair(messages: InboundMessage[], logs: FoodLog[]): TimelineItem[] {
  const taken = new Set<string>();

  return messages.map((message) => {
    if (message.status !== "confirmed") return { message, log: null };

    const at = new Date(message.confirmed_at ?? message.updated_at).getTime();
    const candidates = logs
      .filter((l) => !taken.has(l.id))
      .map((l) => ({ log: l, delta: Math.abs(new Date(l.logged_at).getTime() - at) }))
      // The insert happens in the same request as the confirmation.
      .filter((c) => c.delta <= 10 * 60000)
      .sort((a, b) => {
        const aMatch = a.log.label === message.label ? 0 : 1;
        const bMatch = b.log.label === message.label ? 0 : 1;
        return aMatch - bMatch || a.delta - b.delta;
      });

    const best = candidates[0]?.log ?? null;
    if (best) taken.add(best.id);
    return { message, log: best };
  });
}

/** Inbound food texts for a single day, paired with the entries they created. */
export function useSmsTimeline(dayKey: string) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const dayStart = new Date(`${dayKey}T00:00:00`).toISOString();
    const dayEnd = new Date(new Date(`${dayKey}T00:00:00`).getTime() + 864e5).toISOString();

    const [{ data: messages, error: msgError }, { data: logs }] = await Promise.all([
      supabase
        .from("sms_pending_logs")
        .select("*")
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd)
        .order("created_at", { ascending: false }),
      supabase
        .from("food_logs")
        .select("*")
        .eq("source", "sms")
        .gte("logged_at", dayStart)
        .lt("logged_at", dayEnd)
        .order("logged_at", { ascending: false }),
    ]);

    if (msgError) console.error("sms timeline load failed", msgError);

    setItems(pair((messages ?? []) as InboundMessage[], (logs ?? []) as FoodLog[]));
    setLoading(false);
  }, [dayKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, refresh };
}
