// Glucose state types based on the digital twin model

export type GlucoseState =
  | "In Range – Stable"
  | "In Range – Rising"
  | "In Range – Falling"
  | "Trending High"
  | "High – Rising"
  | "High – Stable"
  | "Trending Low"
  | "Low – Falling";

export type UrgencyLevel = "low" | "medium" | "high";

export interface UserProfile {
  age: number;
  language: string;
  culture: string;
  preferredFoods: string[];
  mobilityLevel: "low" | "moderate" | "high";
  name: string;
}

export interface GlucoseReading {
  currentGlucose: number;
  previousGlucose: number;
  timeDeltaMinutes: number;
  predictedGlucose30min: number;
  predictedGlucose60min: number;
  recentMeal: boolean;
  recentActivity: boolean;
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  timestamp: Date;
}

export interface GlucoseInterpretation {
  state: GlucoseState;
  urgency: UrgencyLevel;
  message: string;
  suggestion?: string;
}

export interface GlucoseData extends GlucoseReading {
  interpretation: GlucoseInterpretation;
  userProfile: UserProfile;
}
