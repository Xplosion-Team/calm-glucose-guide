export interface CarbLog {
  type: string;
  label: string;
  carbs_grams: number | null;
  logged_at: string;
}

export function summarizeDailyCarbs(logs: CarbLog[], now = new Date()) {
  const day = now.toDateString();
  const meals = logs.filter(log => (log.type === "food" || log.type === "drink") &&
    new Date(log.logged_at).toDateString() === day);
  const estimated = meals.filter(meal => meal.carbs_grams !== null && Number.isFinite(meal.carbs_grams) && meal.carbs_grams >= 0);
  return {
    meals,
    total: estimated.reduce((sum, meal) => sum + (meal.carbs_grams ?? 0), 0),
    estimatedCount: estimated.length,
    missingCount: meals.length - estimated.length,
  };
}