import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SmsEvent {
  id: string;
  direction: "outbound" | "inbound";
  phone: string;
  body: string;
  provider: string | null;
  status: string;
  error_message: string | null;
  purpose: string | null;
  outcome: string | null;
  related_table: string | null;
  related_id: string | null;
  occurred_at: string;
}

/** Every text message sent to or received from this person, newest first. */
export function useSmsEvents(days = 14) {
  const [events, setEvents] = useState<SmsEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setEvents([]);
      setLoading(false);
      return;
    }

    const since = new Date(Date.now() - days * 864e5).toISOString();
    const { data, error } = await supabase
      .from("sms_events")
      .select(
        "id, direction, phone, body, provider, status, error_message, purpose, outcome, related_table, related_id, occurred_at",
      )
      .eq("user_id", user.id)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(200);

    if (error) console.error("sms_events load failed", error);
    setEvents((data as SmsEvent[]) ?? []);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  return { events, loading, refresh: load };
}
