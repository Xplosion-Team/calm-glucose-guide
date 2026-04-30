import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_METRICS,
  getHealthProvider,
  type HealthProvider,
} from "@/services/health";
import type {
  HealthAvailability,
  HealthMetricSummary,
  HealthMetricType,
  HealthRecord,
  HealthSnapshot,
} from "@/types/health";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function summarize(
  metric: HealthMetricType,
  records: HealthRecord[]
): HealthMetricSummary {
  const sorted = [...records].sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime()
  );
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const today = sorted.filter((r) => r.startDate.getTime() >= todayStart.getTime());
  const week = sorted.filter((r) => now - r.startDate.getTime() <= SEVEN_DAYS);

  const sum = (xs: HealthRecord[]) => xs.reduce((acc, r) => acc + r.value, 0);
  const avg = (xs: HealthRecord[]) => (xs.length ? sum(xs) / xs.length : undefined);

  // Step count and sleep are summed per day; others are averaged.
  const aggregate = metric === "step_count" || metric === "sleep_analysis";

  return {
    metricType: metric,
    latest: sorted[0],
    todayTotal: aggregate ? sum(today) : undefined,
    todayAverage: aggregate ? undefined : avg(today),
    sevenDayAverage: aggregate ? sum(week) / 7 : avg(week),
    unit: sorted[0]?.unit ?? "",
    records: sorted,
  };
}

export interface UseHealthKitResult {
  snapshot: HealthSnapshot | null;
  availability: HealthAvailability | null;
  isLoading: boolean;
  isConnected: boolean;
  provider: HealthProvider | null;
  connect: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useHealthKit(
  metrics: HealthMetricType[] = DEFAULT_METRICS
): UseHealthKitResult {
  const [provider, setProvider] = useState<HealthProvider | null>(null);
  const [availability, setAvailability] = useState<HealthAvailability | null>(null);
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const refresh = useCallback(async () => {
    if (!provider) return;
    setIsLoading(true);
    try {
      const reader = provider.readMany
        ? provider.readMany.bind(provider)
        : async (ms: HealthMetricType[]) => {
            const out: Partial<Record<HealthMetricType, HealthRecord[]>> = {};
            for (const m of ms) out[m] = await provider.read(m);
            return out;
          };

      const raw = await reader(metrics);
      const summaries: HealthSnapshot["metrics"] = {};
      for (const m of metrics) {
        summaries[m] = summarize(m, raw[m] ?? []);
      }
      setSnapshot({
        metrics: summaries,
        lastSyncAt: new Date(),
        source: provider.name,
      });
    } catch (err) {
      console.warn("[useHealthKit] refresh failed", err);
    } finally {
      setIsLoading(false);
    }
  }, [provider, metrics]);

  const connect = useCallback(async () => {
    if (!provider) return;
    const granted = await provider.requestPermissions(metrics);
    setIsConnected(granted);
    if (granted) await refresh();
  }, [provider, metrics, refresh]);

  // Resolve provider once.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const p = await getHealthProvider();
      if (!mounted) return;
      setProvider(p);
      const a = await p.isAvailable();
      setAvailability(a);
      // Demo provider auto-connects so the dashboard isn't empty in the preview.
      if (p.name === "Demo") setIsConnected(true);
      setIsLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Auto-load once connected.
  useEffect(() => {
    if (isConnected && provider) refresh();
  }, [isConnected, provider, refresh]);

  return {
    snapshot,
    availability,
    isLoading,
    isConnected,
    provider,
    connect,
    refresh,
  };
}
