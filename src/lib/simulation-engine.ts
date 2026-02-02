import type { SimulationRequest, SimulationResult, MealInput, ExerciseInput } from "@/types/simulation";

// Internal reasoning table (never shown to user)
interface SimulationReasoning {
  baselineState: string;
  mealEffect: number; // -2 to +2 scale
  exerciseEffect: number;
  medicationEffect: number;
  netEffect: number;
  timeHorizon: string;
}

function assessMealEffect(meal?: MealInput): number {
  if (!meal) return 0;
  
  const carbMultiplier = {
    low: 0.5,
    moderate: 1,
    high: 1.5
  }[meal.carbLevel];
  
  const portionMultiplier = {
    small: 0.5,
    medium: 1,
    large: 1.5
  }[meal.portionSize];
  
  return carbMultiplier * portionMultiplier; // 0.25 to 2.25
}

function assessExerciseEffect(exercise?: ExerciseInput): number {
  if (!exercise) return 0;
  
  const typeMultiplier = {
    walking: -1,
    standing: -0.3,
    stretching: -0.5,
    resting: 0
  }[exercise.type];
  
  const durationFactor = Math.min(exercise.durationMinutes / 30, 1);
  return typeMultiplier * durationFactor;
}

function generateSummary(reasoning: SimulationReasoning, request: SimulationRequest): string {
  const { meal, exercise } = request.userActions;
  
  if (meal && exercise) {
    if (reasoning.netEffect > 0.5) {
      return `If you have this meal and ${exercise.type === 'walking' ? 'take a walk' : 'move around a bit'}, your blood sugar may still rise, but more gently than if you rested.`;
    } else if (reasoning.netEffect < -0.3) {
      return `With some movement after eating, your blood sugar is likely to stay steadier and come down sooner.`;
    } else {
      return `This combination should help keep things fairly balanced. The movement can help offset some of the meal.`;
    }
  }
  
  if (meal && !exercise) {
    if (reasoning.mealEffect > 1) {
      return `This meal may cause your blood sugar to rise more than usual. That's okay – it happens sometimes.`;
    } else if (reasoning.mealEffect > 0.5) {
      return `This meal will likely cause a gentle rise in your blood sugar over the next hour or so.`;
    } else {
      return `This lighter meal shouldn't push your blood sugar up too much.`;
    }
  }
  
  if (exercise && !meal) {
    if (exercise.durationMinutes >= 20) {
      return `A ${exercise.durationMinutes}-minute ${exercise.type} session should help bring your blood sugar down gently.`;
    } else {
      return `Even a short bit of ${exercise.type} can help smooth out your blood sugar curve.`;
    }
  }
  
  return `Based on your current pattern, things should stay fairly steady.`;
}

function generateBaselineComparison(reasoning: SimulationReasoning, request: SimulationRequest): string {
  const { trend } = request.baseline;
  
  if (trend === "rising") {
    if (reasoning.netEffect < 0) {
      return "Without this activity, your blood sugar would likely keep rising for a while longer.";
    }
    return "Your blood sugar is currently trending upward, which is normal after eating.";
  }
  
  if (trend === "falling") {
    return "Your blood sugar is already coming down on its own, which is a good sign.";
  }
  
  return "Right now, things are fairly stable – this action may keep it that way.";
}

function determineStabilityEffect(reasoning: SimulationReasoning): "more stable" | "less stable" | "unchanged" {
  if (reasoning.netEffect < -0.2) return "more stable";
  if (reasoning.netEffect > 1) return "less stable";
  return "unchanged";
}

function determineProjectedTrend(reasoning: SimulationReasoning, baseline: SimulationRequest["baseline"]): SimulationResult["projectedTrend"] {
  const { netEffect } = reasoning;
  
  if (netEffect < -0.5) return "comes down";
  if (netEffect < 0) return "levels off";
  if (netEffect < 0.5) return "stays steady";
  if (netEffect < 1) return "gentler rise";
  return "steeper rise";
}

function generateGentleTip(request: SimulationRequest): string | undefined {
  const { meal, exercise } = request.userActions;
  
  if (meal && !exercise) {
    return "Even a short walk after eating can help smooth things out.";
  }
  
  if (exercise && exercise.durationMinutes < 15) {
    return "If you're up for it, a few extra minutes of movement can make a difference.";
  }
  
  if (meal?.carbLevel === "high") {
    return "Pairing carbs with some protein or fiber can help slow down the rise.";
  }
  
  return undefined;
}

export function runSimulation(request: SimulationRequest): SimulationResult {
  const { userActions, baseline } = request;
  
  // Build internal reasoning (never shown to user)
  const reasoning: SimulationReasoning = {
    baselineState: `${baseline.currentGlucose} mg/dL, ${baseline.trend}`,
    mealEffect: assessMealEffect(userActions.meal),
    exerciseEffect: assessExerciseEffect(userActions.exercise),
    medicationEffect: userActions.medication?.taken ? -0.3 : 0,
    netEffect: 0,
    timeHorizon: "30-60 minutes"
  };
  
  reasoning.netEffect = reasoning.mealEffect + reasoning.exerciseEffect + reasoning.medicationEffect;
  
  return {
    simulationSummary: generateSummary(reasoning, request),
    baselineComparison: generateBaselineComparison(reasoning, request),
    stabilityEffect: determineStabilityEffect(reasoning),
    confidenceNote: "Everyone responds a little differently, but this is a common pattern.",
    gentleTip: generateGentleTip(request),
    projectedTrend: determineProjectedTrend(reasoning, baseline)
  };
}
