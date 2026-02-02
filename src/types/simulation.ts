// Simulation types for the what-if digital twin

export interface MealInput {
  description: string;
  portionSize: "small" | "medium" | "large";
  carbLevel: "low" | "moderate" | "high";
}

export interface ExerciseInput {
  type: "walking" | "standing" | "stretching" | "resting";
  durationMinutes: number;
}

export interface MedicationInput {
  taken: boolean;
  timing: "on-time" | "delayed" | "skipped";
}

export interface SimulationRequest {
  baseline: {
    currentGlucose: number;
    trend: "rising" | "falling" | "stable";
    predicted60min: number;
  };
  userActions: {
    meal?: MealInput;
    exercise?: ExerciseInput;
    medication?: MedicationInput;
  };
}

export interface SimulationResult {
  simulationSummary: string;
  baselineComparison: string;
  stabilityEffect: "more stable" | "less stable" | "unchanged";
  confidenceNote: string;
  gentleTip?: string;
  projectedTrend: "gentler rise" | "steeper rise" | "levels off" | "comes down" | "stays steady";
}
