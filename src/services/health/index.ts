import type { HealthProvider } from "./HealthProvider";
import { HealthKitProvider } from "./healthkitProvider";
import { DemoHealthProvider } from "./demoProvider";

let cached: HealthProvider | null = null;

/**
 * Resolves the best available health provider.
 * - HealthKit (via Despia) when running in the native iOS shell.
 * - Demo provider everywhere else, so the web preview stays usable.
 */
export async function getHealthProvider(): Promise<HealthProvider> {
  if (cached) return cached;
  const hk = new HealthKitProvider();
  const availability = await hk.isAvailable();
  cached = availability.available ? hk : new DemoHealthProvider();
  return cached;
}

export { HealthKitProvider, DemoHealthProvider };
export type { HealthProvider } from "./HealthProvider";
export { DEFAULT_METRICS } from "./HealthProvider";
