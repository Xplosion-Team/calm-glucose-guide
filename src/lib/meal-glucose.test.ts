import { describe, it, expect } from "vitest";
import { mealCurve, unmatchedRises, type Reading } from "./meal-glucose";

const T0 = Date.parse("2026-10-16T17:00:00Z");
const r = (min: number, v: number): Reading => ({ t: T0 + min * 60000, v });
const lunch = [r(-30, 112), r(0, 114), r(15, 120), r(30, 150), r(45, 169), r(60, 155), r(90, 120), r(120, 104)];

describe("meal glucose pairing", () => {
  it("measures the rise after a meal from its pre-meal low", () => {
    const m = mealCurve({ id: "1", label: "Salmon", type: "food", carbs: 52, at: T0 }, lunch);
    expect(m.baseline).toBe(112);
    expect(m.peak).toBe(169);
    expect(m.rise).toBe(57);
  });

  it("reports no rise when readings are missing", () => {
    const m = mealCurve({ id: "1", label: "Nuggets", type: "food", carbs: 30, at: T0 + 10 * 3.6e6 }, lunch);
    expect(m.rise).toBeNull();
  });

  it("flags a 30+ rise with no meal nearby, but not one explained by a meal", () => {
    expect(unmatchedRises(lunch, [])).toHaveLength(1);
    expect(unmatchedRises(lunch, [{ id: "1", label: "x", type: "food", carbs: 1, at: T0 + 5 * 60000 }])).toHaveLength(0);
    expect(unmatchedRises(lunch.map((p) => ({ ...p, v: 110 })), [])).toHaveLength(0);
  });
});
