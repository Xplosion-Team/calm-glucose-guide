// Pairs logged meals with the glucose curve around them, and finds rises
// that have no logged meal nearby. Pure so it can be unit tested.

export interface Reading { t: number; v: number }
export interface MealIn { id: string; label: string; type: string; carbs: number | null; at: number }

export interface MealWithCurve extends MealIn {
  points: Reading[];        // -30 min .. +3 h
  baseline: number | null;
  peak: number | null;
  rise: number | null;      // peak - baseline
  peakAt: number | null;
}

export interface UnmatchedRise { start: number; startValue: number; peak: number; peakAt: number; points: Reading[] }

const MIN = 60000;

export function mealCurve(meal: MealIn, readings: Reading[]): MealWithCurve {
  const points = readings.filter((r) => r.t >= meal.at - 30 * MIN && r.t <= meal.at + 180 * MIN);
  const before = points.filter((r) => r.t <= meal.at + 15 * MIN);
  const after = points.filter((r) => r.t >= meal.at && r.t <= meal.at + 150 * MIN);
  if (!before.length || after.length < 3) {
    return { ...meal, points, baseline: null, peak: null, rise: null, peakAt: null };
  }
  const baseline = Math.min(...before.map((r) => r.v));
  const top = after.reduce((a, b) => (b.v > a.v ? b : a));
  return { ...meal, points, baseline, peak: top.v, rise: Math.round(top.v - baseline), peakAt: top.t };
}

// Rises of >= minRise within 2 h of a low point, with no meal from 60 min before to 90 min after.
export function unmatchedRises(readings: Reading[], meals: MealIn[], minRise = 30): UnmatchedRise[] {
  const pts = [...readings].sort((a, b) => a.t - b.t);
  const out: UnmatchedRise[] = [];
  let i = 0;
  while (i < pts.length) {
    const trough = pts[i];
    const win = pts.filter((p) => p.t > trough.t && p.t - trough.t <= 120 * MIN);
    const top = win.reduce<Reading | null>((a, b) => (!a || b.v > a.v ? b : a), null);
    const lower = win.find((p) => p.t < (top?.t ?? 0) && p.v < trough.v);
    if (top && !lower && top.v - trough.v >= minRise) {
      const explained = meals.some((m) => m.at >= trough.t - 90 * MIN && m.at <= trough.t + 60 * MIN);
      if (!explained) {
        out.push({
          start: trough.t, startValue: trough.v, peak: top.v, peakAt: top.t,
          points: pts.filter((p) => p.t >= trough.t - 30 * MIN && p.t <= trough.t + 180 * MIN),
        });
      }
      i = pts.findIndex((p) => p.t > top.t + 60 * MIN);
      if (i < 0) break;
      continue;
    }
    i++;
  }
  return out.reverse();
}
