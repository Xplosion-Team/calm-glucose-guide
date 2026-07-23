import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface NotificationPrefs {
  spike_enabled: boolean;
  spike_sensitivity: "low" | "medium" | "high";
  quiet_start_hour: number | null;
  quiet_end_hour: number | null;
  daily_insight_enabled: boolean;
  daily_insight_hour: number;
}

const DEFAULTS: NotificationPrefs = {
  spike_enabled: true,
  spike_sensitivity: "medium",
  quiet_start_hour: null,
  quiet_end_hour: null,
  daily_insight_enabled: true,
  daily_insight_hour: 8,
};

export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLoaded(true); return; }
      const { data } = await supabase
        .from("notification_prefs")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (!mounted) return;
      if (data) setPrefs({ ...DEFAULTS, ...(data as Partial<NotificationPrefs>) });
      setLoaded(true);
    })();
    return () => { mounted = false; };
  }, []);

  const save = useCallback(async (patch: Partial<NotificationPrefs>) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await supabase
      .from("notification_prefs")
      .upsert({ user_id: u.user.id, ...next }, { onConflict: "user_id" });
  }, [prefs]);

  return { prefs, save, loaded };
}
