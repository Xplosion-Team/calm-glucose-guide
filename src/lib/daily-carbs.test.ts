import { describe, expect, it } from "vitest";
import { summarizeDailyCarbs } from "./daily-carbs";

describe("daily logged carbs", () => {
  const now = new Date(2026, 9, 16, 14, 56);
  const at = new Date(2026, 9, 16, 12).toISOString();
  it("totals saved meal and drink carbs but excludes medication", () => {
    const result = summarizeDailyCarbs([
      { type: "food", label: "Salmon, mashed potatoes, macaroni", carbs_grams: 65, logged_at: at },
      { type: "drink", label: "Milk", carbs_grams: 12, logged_at: at },
      { type: "medication", label: "Medication", carbs_grams: 100, logged_at: at },
    ], now);
    expect(result.total).toBe(77);
    expect(result.meals).toHaveLength(2);
  });
  it("uses the member's local day and excludes previous meals", () => {
    const result = summarizeDailyCarbs([
      { type: "food", label: "Yesterday", carbs_grams: 45, logged_at: new Date(2026, 9, 15, 23).toISOString() },
      { type: "food", label: "Today", carbs_grams: 30, logged_at: at },
    ], now);
    expect(result.total).toBe(30);
  });
  it("does not count missing carb estimates as known zero-carb meals", () => {
    const result = summarizeDailyCarbs([
      { type: "food", label: "Unknown amount", carbs_grams: null, logged_at: at },
      { type: "drink", label: "Water", carbs_grams: 0, logged_at: at },
    ], now);
    expect(result.total).toBe(0);
    expect(result.estimatedCount).toBe(1);
    expect(result.missingCount).toBe(1);
  });
});