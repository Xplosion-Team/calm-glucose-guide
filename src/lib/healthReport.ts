// Shared helpers for computing Health Report statistics from raw data.
// Runs entirely client-side (or in edge functions) — no medical advice.

export interface CgmReading { ts: string; mg_dl: number }
export interface FoodLogRow {
  id: string;
  type: "food" | "drink" | "med";
  label: string;
  carbs_grams: number | null;
  portion_size: string | null;
  source: string;
  logged_at: string;
}
export interface MedEventRow {
  id: string;
  medication_id: string;
  taken_at: string;
  dose: number | null;
  source: string;
}
export interface MedicationRow {
  id: string;
  name: string;
  med_class: string | null;
  dose: number | null;
  unit: string | null;
}
export interface MealResponseRow {
  food_log_id: string;
  meal_score: number | null;
  peak_mg_dl: number | null;
  recovery_time_min: number | null;
}

export interface CgmStats {
  count: number;
  avg: number | null;
  gmi: number | null;
  tir: number; // % 70–180
  tar: number; // % > 180
  tbr: number; // % < 70
  min: number | null;
  max: number | null;
  std: number | null;
  cv: number | null;
  sensorWearPct: number | null;
}

export interface DailyStat {
  date: string;
  avg: number | null;
  tir: number;
  max: number | null;
  min: number | null;
  count: number;
}

export interface FoodSummary {
  total: number;
  avgCarbs: number | null;
  top: { label: string; count: number }[];
}

export interface MedSummary {
  total: number;
  insulinCount: number;
  otherCount: number;
}

export interface HealthReport {
  startDate: string;
  endDate: string;
  cgm: CgmStats;
  daily: DailyStat[];
  foodSummary: FoodSummary;
  medSummary: MedSummary;
  summaryText: string;
}

const TIR_LOW = 70;
const TIR_HIGH = 180;

export function computeCgmStats(readings: CgmReading[], startISO: string, endISO: string): CgmStats {
  if (readings.length === 0) {
    return { count: 0, avg: null, gmi: null, tir: 0, tar: 0, tbr: 0, min: null, max: null, std: null, cv: null, sensorWearPct: null };
  }
  const values = readings.map((r) => Number(r.mg_dl));
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const inRange = values.filter((v) => v >= TIR_LOW && v <= TIR_HIGH).length;
  const above = values.filter((v) => v > TIR_HIGH).length;
  const below = values.filter((v) => v < TIR_LOW).length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  const cv = avg > 0 ? (std / avg) * 100 : null;
  // GMI (%) = 3.31 + 0.02392 * mean glucose
  const gmi = 3.31 + 0.02392 * avg;

  // Sensor wear: expected 288 readings/day at 5-min interval
  const durationMs = new Date(endISO).getTime() - new Date(startISO).getTime();
  const days = Math.max(1, durationMs / 86400000);
  const expected = days * 288;
  const sensorWearPct = expected > 0 ? Math.min(100, (readings.length / expected) * 100) : null;

  return {
    count: readings.length,
    avg: Math.round(avg * 10) / 10,
    gmi: Math.round(gmi * 100) / 100,
    tir: Math.round((inRange / values.length) * 1000) / 10,
    tar: Math.round((above / values.length) * 1000) / 10,
    tbr: Math.round((below / values.length) * 1000) / 10,
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    std: Math.round(std * 10) / 10,
    cv: cv != null ? Math.round(cv * 10) / 10 : null,
    sensorWearPct: sensorWearPct != null ? Math.round(sensorWearPct * 10) / 10 : null,
  };
}

export function computeDailyStats(readings: CgmReading[]): DailyStat[] {
  const map = new Map<string, number[]>();
  for (const r of readings) {
    const d = r.ts.slice(0, 10);
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(Number(r.mg_dl));
  }
  const out: DailyStat[] = [];
  for (const [date, values] of map) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const inRange = values.filter((v) => v >= TIR_LOW && v <= TIR_HIGH).length;
    out.push({
      date,
      avg: Math.round(avg * 10) / 10,
      tir: Math.round((inRange / values.length) * 1000) / 10,
      max: Math.max(...values),
      min: Math.min(...values),
      count: values.length,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function computeFoodSummary(logs: FoodLogRow[]): FoodSummary {
  const meals = logs.filter((l) => l.type === "food" || l.type === "drink");
  const withCarbs = meals.filter((l) => l.carbs_grams != null);
  const avgCarbs = withCarbs.length
    ? Math.round(withCarbs.reduce((s, l) => s + (l.carbs_grams ?? 0), 0) / withCarbs.length)
    : null;
  const counts = new Map<string, number>();
  for (const m of meals) {
    const key = m.label.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => {
      const original = meals.find((m) => m.label.trim().toLowerCase() === label)?.label ?? label;
      return { label: original, count };
    });
  return { total: meals.length, avgCarbs, top };
}

export function computeMedSummary(events: MedEventRow[], meds: MedicationRow[]): MedSummary {
  const byId = new Map(meds.map((m) => [m.id, m]));
  let insulin = 0;
  for (const e of events) {
    const m = byId.get(e.medication_id);
    if (m?.med_class?.toLowerCase().includes("insulin")) insulin++;
  }
  return { total: events.length, insulinCount: insulin, otherCount: events.length - insulin };
}

export function buildSummaryText(report: Omit<HealthReport, "summaryText">, lang: "en" | "es" = "en"): string {
  const { cgm, foodSummary, medSummary } = report;
  if (cgm.count === 0 && foodSummary.total === 0 && medSummary.total === 0) {
    return lang === "es"
      ? "No se registraron datos en este período."
      : "No data was recorded during this period.";
  }
  const parts: string[] = [];
  if (cgm.avg != null) {
    parts.push(lang === "es"
      ? `Durante este período de reporte, el participante mantuvo una glucosa promedio de ${cgm.avg} mg/dL con ${cgm.tir}% de Tiempo en Rango.`
      : `During this reporting period the participant maintained an average glucose of ${cgm.avg} mg/dL with ${cgm.tir}% Time In Range.`);
  }
  parts.push(lang === "es"
    ? `Se registraron ${foodSummary.total} comidas y ${medSummary.total} eventos de medicación.`
    : `${foodSummary.total} meals and ${medSummary.total} medication events were logged.`);
  if (cgm.sensorWearPct != null) {
    parts.push(lang === "es"
      ? `Uso del sensor CGM: ${cgm.sensorWearPct}%.`
      : `CGM sensor wear: ${cgm.sensorWearPct}%.`);
  }
  return parts.join(" ");
}

export function assembleReport(
  readings: CgmReading[],
  logs: FoodLogRow[],
  medEvents: MedEventRow[],
  medications: MedicationRow[],
  startISO: string,
  endISO: string,
  lang: "en" | "es" = "en",
): HealthReport {
  const cgm = computeCgmStats(readings, startISO, endISO);
  const daily = computeDailyStats(readings);
  const foodSummary = computeFoodSummary(logs);
  const medSummary = computeMedSummary(medEvents, medications);
  const partial = {
    startDate: startISO.slice(0, 10),
    endDate: endISO.slice(0, 10),
    cgm, daily, foodSummary, medSummary,
  };
  return { ...partial, summaryText: buildSummaryText(partial, lang) };
}
