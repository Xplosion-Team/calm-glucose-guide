import despia from "despia-native";
import type {
  HealthAvailability,
  HealthMetricType,
  HealthRecord,
} from "@/types/health";
import { type HealthProvider, readManyDefault } from "./HealthProvider";

// Map our internal metric names to HealthKit identifiers.
// Add new metrics here to extend the integration.
const HK_IDENTIFIERS: Record<HealthMetricType, string> = {
  blood_glucose: "HKQuantityTypeIdentifierBloodGlucose",
  step_count: "HKQuantityTypeIdentifierStepCount",
  heart_rate: "HKQuantityTypeIdentifierHeartRate",
  body_mass: "HKQuantityTypeIdentifierBodyMass",
  sleep_analysis: "HKCategoryTypeIdentifierSleepAnalysis",
};

const HK_UNITS: Record<HealthMetricType, string> = {
  blood_glucose: "mg/dL",
  step_count: "count",
  heart_rate: "bpm",
  body_mass: "kg",
  sleep_analysis: "minutes",
};

function isInDespiaShell(): boolean {
  if (typeof window === "undefined") return false;
  // Despia injects a userAgent marker and a global bridge.
  const ua = window.navigator?.userAgent || "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return /Despia/i.test(ua) || !!w.despia || !!w.webkit?.messageHandlers?.despia;
}

interface RawHealthSample {
  uuid?: string;
  value?: number | string;
  quantity?: number;
  unit?: string;
  startDate?: string;
  endDate?: string;
  source?: string;
  sourceName?: string;
}

function normalize(
  metric: HealthMetricType,
  raw: RawHealthSample,
  index: number
): HealthRecord {
  const start = raw.startDate ? new Date(raw.startDate) : new Date();
  const end = raw.endDate ? new Date(raw.endDate) : start;
  const numericValue =
    typeof raw.value === "number"
      ? raw.value
      : typeof raw.quantity === "number"
        ? raw.quantity
        : Number(raw.value ?? 0);

  return {
    id: raw.uuid ?? `${metric}-${start.getTime()}-${index}`,
    metricType: metric,
    value: Number.isFinite(numericValue) ? numericValue : 0,
    unit: raw.unit || HK_UNITS[metric],
    startDate: start,
    endDate: end,
    source: raw.sourceName || raw.source || "AppleHealth",
    recordedAt: new Date(),
  };
}

export class HealthKitProvider implements HealthProvider {
  readonly name = "AppleHealth";

  async isAvailable(): Promise<HealthAvailability> {
    if (typeof window === "undefined") {
      return { available: false, reason: "unsupported", message: "No window context." };
    }
    if (!isInDespiaShell()) {
      return {
        available: false,
        reason: "not_ios",
        message: "Apple Health is only available on iPhone in the native app.",
      };
    }
    return { available: true };
  }

  async requestPermissions(metrics: HealthMetricType[]): Promise<boolean> {
    const available = await this.isAvailable();
    if (!available.available) return false;
    try {
      const ids = metrics.map((m) => HK_IDENTIFIERS[m]);
      // Despia's HealthKit read URL also triggers the permission prompt
      // the first time it's called per metric, so a no-op probe is enough.
      await despia(`readhealthkit://${ids[0]}`, ids);
      return true;
    } catch (err) {
      console.warn("[HealthKit] permission request failed", err);
      return false;
    }
  }

  async read(
    metric: HealthMetricType,
    _options?: { startDate?: Date; endDate?: Date; limit?: number }
  ): Promise<HealthRecord[]> {
    const available = await this.isAvailable();
    if (!available.available) return [];

    const id = HK_IDENTIFIERS[metric];
    try {
      // TODO: pass a date window once Despia exposes a documented param shape.
      const result = await despia(`readhealthkit://${id}`, [id]);
      const samples: RawHealthSample[] = Array.isArray(result)
        ? result
        : Array.isArray((result as { samples?: RawHealthSample[] })?.samples)
          ? (result as { samples: RawHealthSample[] }).samples
          : [];

      return samples
        .map((s, i) => normalize(metric, s, i))
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    } catch (err) {
      console.warn(`[HealthKit] read ${metric} failed`, err);
      return [];
    }
  }

  readMany(
    metrics: HealthMetricType[],
    options?: { startDate?: Date; endDate?: Date; limit?: number }
  ) {
    return readManyDefault(this, metrics, options);
  }
}
