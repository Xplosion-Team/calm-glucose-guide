import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProgressMilestone {
  id: string;
  /** Stable ISO date for sorting; component formats for display */
  at: string;
  title: string;
  detail: string;
  kind: "account" | "t1pal" | "log" | "streak";
}

export interface ProgressStats {
  loading: boolean;
  error: string | null;
  /** Account creation date (auth user) */
  accountCreatedAt: string | null;
  /** T1Pal connection record */
  t1palConnectedAt: string | null;
  t1palStatus: string | null;
  /** Real numbers — null = no data */
  daysTracked: number;
  totalLogs: number;
  totalReadings: number;
  avgGlucose: number | null;
  timeInRangePct: number | null;
  bestStreakDays: number;
  /** Real, chronological milestones (most recent first) */
  milestones: ProgressMilestone[];
  refresh: () => Promise<void>;
}

// Standard adult TIR window (mg/dL). Conservative, non-clinical.
const TIR_LOW = 70;
const TIR_HIGH = 180;

// Look back 14 days for the avg/TIR window — matches typical CGM reports.
const WINDOW_DAYS = 14;

function startOfDayISO(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function computeStreak(dayKeys: Set<string>): number {
  // Longest consecutive-day streak across logged days.
  if (dayKeys.size === 0) return 0;
  const sorted = Array.from(dayKeys).sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const next = new Date(sorted[i]);
    const diff = Math.round((next.getTime() - prev.getTime()) / 86_400_000);
    if (diff === 1) {
      cur += 1;
      if (cur > best) best = cur;
    } else if (diff > 1) {
      cur = 1;
    }
  }
  return best;
}

export function useProgressStats(): ProgressStats {
  const [state, setState] = useState<Omit<ProgressStats, "refresh">>({
    loading: true,
    error: null,
    accountCreatedAt: null,
    t1palConnectedAt: null,
    t1palStatus: null,
    daysTracked: 0,
    totalLogs: 0,
    totalReadings: 0,
    avgGlucose: null,
    timeInRangePct: null,
    bestStreakDays: 0,
    milestones: [],
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        setState((s) => ({ ...s, loading: false, error: "Not signed in" }));
        return;
      }

      const sinceISO = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

      const [t1palRes, readingsRes, foodLogsRes, firstFoodRes, firstReadingRes] =
        await Promise.all([
          (supabase as any)
            .from("t1pal_connections")
            .select("created_at,status,last_sync_at,last_successful_reading_at")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("cgm_readings")
            .select("mg_dl,ts")
            .eq("user_id", user.id)
            .gte("ts", sinceISO)
            .order("ts", { ascending: false })
            .limit(5000),
          supabase
            .from("food_logs")
            .select("id,logged_at,label,type")
            .eq("user_id", user.id)
            .order("logged_at", { ascending: false })
            .limit(500),
          supabase
            .from("food_logs")
            .select("logged_at,label")
            .eq("user_id", user.id)
            .order("logged_at", { ascending: true })
            .limit(1),
          supabase
            .from("cgm_readings")
            .select("ts")
            .eq("user_id", user.id)
            .order("ts", { ascending: true })
            .limit(1),
        ]);

      const readings = (readingsRes.data ?? []) as { mg_dl: number; ts: string }[];
      const foodLogs = (foodLogsRes.data ?? []) as {
        id: string;
        logged_at: string;
        label: string;
        type: string;
      }[];

      // avg + TIR from real CGM readings in window
      let avg: number | null = null;
      let tir: number | null = null;
      if (readings.length > 0) {
        const sum = readings.reduce((a, r) => a + r.mg_dl, 0);
        avg = Math.round(sum / readings.length);
        const inRange = readings.filter((r) => r.mg_dl >= TIR_LOW && r.mg_dl <= TIR_HIGH).length;
        tir = Math.round((inRange / readings.length) * 100);
      }

      // days tracked = unique calendar days the user did anything (log or reading)
      const dayKeys = new Set<string>();
      for (const r of readings) dayKeys.add(startOfDayISO(new Date(r.ts)));
      for (const l of foodLogs) dayKeys.add(startOfDayISO(new Date(l.logged_at)));

      const t1pal = t1palRes?.data as
        | { created_at: string; status: string; last_sync_at: string | null; last_successful_reading_at: string | null }
        | null;

      // Build real milestones
      const milestones: ProgressMilestone[] = [];
      if (user.created_at) {
        milestones.push({
          id: "account",
          at: user.created_at,
          title: "Started your journey",
          detail: "You created your Calm Glucose account.",
          kind: "account",
        });
      }
      if (t1pal?.created_at) {
        milestones.push({
          id: "t1pal-connected",
          at: t1pal.created_at,
          title: "Connected T1Pal",
          detail:
            t1pal.status === "connected"
              ? "Your CGM, insulin, and meal data are now syncing."
              : `Connection status: ${t1pal.status}.`,
          kind: "t1pal",
        });
      }
      if (t1pal?.last_successful_reading_at) {
        milestones.push({
          id: "t1pal-last-reading",
          at: t1pal.last_successful_reading_at,
          title: "Latest T1Pal reading received",
          detail: "Your most recent CGM value was synced from T1Pal.",
          kind: "t1pal",
        });
      }
      const firstFood = (firstFoodRes.data ?? [])[0] as { logged_at: string; label: string } | undefined;
      if (firstFood) {
        milestones.push({
          id: "first-log",
          at: firstFood.logged_at,
          title: "First entry logged",
          detail: `You logged: ${firstFood.label}.`,
          kind: "log",
        });
      }
      const firstReading = (firstReadingRes.data ?? [])[0] as { ts: string } | undefined;
      if (firstReading) {
        milestones.push({
          id: "first-reading",
          at: firstReading.ts,
          title: "First glucose reading recorded",
          detail: "Your first CGM value arrived in Calm Glucose.",
          kind: "log",
        });
      }
      if (foodLogs.length >= 10) {
        const tenth = foodLogs[foodLogs.length - Math.min(foodLogs.length, 10)];
        milestones.push({
          id: "ten-logs",
          at: tenth.logged_at,
          title: "10 entries logged",
          detail: "Consistent logging helps your insights get more personal.",
          kind: "log",
        });
      }

      milestones.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

      setState({
        loading: false,
        error: null,
        accountCreatedAt: user.created_at ?? null,
        t1palConnectedAt: t1pal?.created_at ?? null,
        t1palStatus: t1pal?.status ?? null,
        daysTracked: dayKeys.size,
        totalLogs: foodLogs.length,
        totalReadings: readings.length,
        avgGlucose: avg,
        timeInRangePct: tir,
        bestStreakDays: computeStreak(dayKeys),
        milestones,
      });
    } catch (err: any) {
      setState((s) => ({ ...s, loading: false, error: err?.message ?? "Failed to load progress" }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: load };
}
