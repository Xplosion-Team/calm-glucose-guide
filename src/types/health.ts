// Generic, provider-agnostic health record types.
// Any health source (Apple HealthKit via Despia, Google Fit later, etc.)
// must normalize into these shapes.

export type HealthMetricType =
  | "blood_glucose"
  | "step_count"
  | "heart_rate"
  | "body_mass"
  | "sleep_analysis";

export interface HealthRecord {
  id: string;
  metricType: HealthMetricType;
  value: number;
  unit: string;
  startDate: Date;
  endDate: Date;
  source: string; // e.g. "AppleHealth", "Demo"
  recordedAt: Date;
}

export interface HealthMetricSummary {
  metricType: HealthMetricType;
  latest?: HealthRecord;
  todayTotal?: number;
  todayAverage?: number;
  sevenDayAverage?: number;
  unit: string;
  records: HealthRecord[]; // recent window, newest first
}

export interface HealthSnapshot {
  metrics: Partial<Record<HealthMetricType, HealthMetricSummary>>;
  lastSyncAt: Date | null;
  source: string;
}

export type HealthAvailability =
  | { available: true }
  | { available: false; reason: "not_ios" | "permission_denied" | "unsupported" | "error"; message: string };
