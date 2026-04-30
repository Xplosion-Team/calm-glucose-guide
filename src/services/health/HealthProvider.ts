import type {
  HealthAvailability,
  HealthMetricType,
  HealthRecord,
} from "@/types/health";

/**
 * Generic interface every health data source must implement.
 * Components and hooks must depend only on this interface — never on
 * a specific SDK (Despia, Capacitor Health, etc.) directly.
 */
export interface HealthProvider {
  readonly name: string;

  /** Whether this provider can run in the current environment. */
  isAvailable(): Promise<HealthAvailability>;

  /** Triggers the native permission flow (or no-op for fallbacks). */
  requestPermissions(metrics: HealthMetricType[]): Promise<boolean>;

  /** Reads a single metric over the given window. Newest first. */
  read(
    metric: HealthMetricType,
    options?: { startDate?: Date; endDate?: Date; limit?: number }
  ): Promise<HealthRecord[]>;

  /** Reads many metrics in parallel. Default implementation provided. */
  readMany?(
    metrics: HealthMetricType[],
    options?: { startDate?: Date; endDate?: Date; limit?: number }
  ): Promise<Partial<Record<HealthMetricType, HealthRecord[]>>>;
}

/** Default fan-out helper if a provider doesn't override readMany. */
export async function readManyDefault(
  provider: HealthProvider,
  metrics: HealthMetricType[],
  options?: { startDate?: Date; endDate?: Date; limit?: number }
): Promise<Partial<Record<HealthMetricType, HealthRecord[]>>> {
  const results = await Promise.all(
    metrics.map(async (m) => [m, await provider.read(m, options)] as const)
  );
  return Object.fromEntries(results) as Partial<Record<HealthMetricType, HealthRecord[]>>;
}

export const DEFAULT_METRICS: HealthMetricType[] = [
  "blood_glucose",
  "step_count",
  "heart_rate",
  "body_mass",
  "sleep_analysis",
];
