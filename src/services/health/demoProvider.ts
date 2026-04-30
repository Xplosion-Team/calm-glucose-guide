import type {
  HealthAvailability,
  HealthMetricType,
  HealthRecord,
} from "@/types/health";
import { type HealthProvider, readManyDefault } from "./HealthProvider";

// Fallback provider used in the web preview and on non-iOS environments.
// Generates stable-looking demo data so screens are never empty.
export class DemoHealthProvider implements HealthProvider {
  readonly name = "Demo";

  async isAvailable(): Promise<HealthAvailability> {
    return { available: true };
  }

  async requestPermissions(): Promise<boolean> {
    return true;
  }

  async read(
    metric: HealthMetricType,
    options?: { limit?: number }
  ): Promise<HealthRecord[]> {
    const limit = options?.limit ?? 24;
    const now = Date.now();
    const out: HealthRecord[] = [];

    for (let i = 0; i < limit; i++) {
      const start = new Date(now - i * 60 * 60 * 1000);
      out.push({
        id: `${metric}-demo-${i}`,
        metricType: metric,
        value: this.demoValue(metric, i),
        unit: this.unit(metric),
        startDate: start,
        endDate: new Date(start.getTime() + 60 * 1000),
        source: "Demo",
        recordedAt: new Date(),
      });
    }
    return out;
  }

  readMany(metrics: HealthMetricType[]) {
    return readManyDefault(this, metrics);
  }

  private unit(metric: HealthMetricType): string {
    switch (metric) {
      case "blood_glucose":
        return "mg/dL";
      case "step_count":
        return "count";
      case "heart_rate":
        return "bpm";
      case "body_mass":
        return "kg";
      case "sleep_analysis":
        return "minutes";
    }
  }

  private demoValue(metric: HealthMetricType, i: number): number {
    const wave = Math.sin(i / 3);
    switch (metric) {
      case "blood_glucose":
        return Math.round(115 + wave * 15);
      case "step_count":
        return Math.max(0, Math.round(450 + wave * 250));
      case "heart_rate":
        return Math.round(72 + wave * 6);
      case "body_mass":
        return 78.4;
      case "sleep_analysis":
        return Math.round(60 + Math.abs(wave) * 30);
    }
  }
}
