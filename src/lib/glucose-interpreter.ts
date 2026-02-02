import type { GlucoseReading, GlucoseInterpretation, GlucoseState, UrgencyLevel, UserProfile } from "@/types/glucose";

// Classify glucose state based on dynamics
function classifyState(reading: GlucoseReading): GlucoseState {
  const { currentGlucose, previousGlucose, timeDeltaMinutes } = reading;
  const rateOfChange = (currentGlucose - previousGlucose) / timeDeltaMinutes;
  
  // Thresholds (soft, non-clinical)
  const inRangeLow = 70;
  const inRangeHigh = 140;
  const highThreshold = 180;
  
  const isRising = rateOfChange > 0.5;
  const isFalling = rateOfChange < -0.5;
  const isStable = !isRising && !isFalling;
  
  if (currentGlucose < inRangeLow) {
    return isFalling ? "Low – Falling" : "Trending Low";
  }
  
  if (currentGlucose > highThreshold) {
    return isRising ? "High – Rising" : "High – Stable";
  }
  
  if (currentGlucose > inRangeHigh) {
    return "Trending High";
  }
  
  // In range
  if (isRising) return "In Range – Rising";
  if (isFalling) return "In Range – Falling";
  return "In Range – Stable";
}

// Determine urgency level
function determineUrgency(state: GlucoseState, reading: GlucoseReading): UrgencyLevel {
  const { predictedGlucose30min, predictedGlucose60min } = reading;
  
  // High urgency states
  if (state === "Low – Falling" || state === "High – Rising") {
    if (predictedGlucose30min < 55 || predictedGlucose60min > 250) {
      return "high";
    }
    return "medium";
  }
  
  // Medium urgency
  if (state === "Trending Low" || state === "High – Stable") {
    return "medium";
  }
  
  // Low urgency for stable states
  return "low";
}

// Generate human-readable message
function generateMessage(state: GlucoseState, reading: GlucoseReading, profile: UserProfile): string {
  const timeContext = {
    morning: "this morning",
    afternoon: "this afternoon",
    evening: "this evening",
    night: "tonight"
  }[reading.timeOfDay];
  
  const mealContext = reading.recentMeal ? " This often happens after eating." : "";
  const activityContext = reading.recentActivity ? " Your recent activity is helping." : "";
  
  const messages: Record<GlucoseState, string> = {
    "In Range – Stable": `Your glucose is looking steady ${timeContext}. You're doing great, ${profile.name}.${activityContext}`,
    "In Range – Rising": `Your glucose is gently rising ${timeContext}.${mealContext} Nothing to worry about.`,
    "In Range – Falling": `Your glucose is coming down nicely ${timeContext}.${activityContext} You're in a good place.`,
    "Trending High": `Your glucose is a bit higher ${timeContext}.${mealContext} This is quite normal and will likely settle.`,
    "High – Rising": `Your glucose is climbing ${timeContext}.${mealContext} Let's keep an eye on it together.`,
    "High – Stable": `Your glucose is elevated but holding steady ${timeContext}. It should start coming down soon.`,
    "Trending Low": `Your glucose is getting a bit low ${timeContext}. You might want a small snack.`,
    "Low – Falling": `Your glucose is dropping ${timeContext}. A small snack would be helpful right now.`
  };
  
  return messages[state];
}

// Generate gentle suggestion
function generateSuggestion(state: GlucoseState, reading: GlucoseReading, profile: UserProfile): string | undefined {
  const mobilityAware = profile.mobilityLevel === "low" 
    ? "If you're able, standing up for a moment might help."
    : "A short, gentle walk could help things settle.";
  
  const suggestions: Partial<Record<GlucoseState, string>> = {
    "In Range – Stable": undefined, // No suggestion needed
    "In Range – Rising": reading.recentMeal ? undefined : "A glass of water can help keep things balanced.",
    "Trending High": mobilityAware,
    "High – Rising": `${mobilityAware} Some water might help too.`,
    "High – Stable": "Staying hydrated and relaxed will help it come down naturally.",
    "Trending Low": "A small piece of fruit or a few crackers could be just right.",
    "Low – Falling": "Please have a small snack soon – some juice or crackers would be perfect."
  };
  
  return suggestions[state];
}

// Main interpretation function
export function interpretGlucose(reading: GlucoseReading, profile: UserProfile): GlucoseInterpretation {
  const state = classifyState(reading);
  const urgency = determineUrgency(state, reading);
  const message = generateMessage(state, reading, profile);
  const suggestion = generateSuggestion(state, reading, profile);
  
  return {
    state,
    urgency,
    message,
    suggestion
  };
}

// Get time of day
export function getTimeOfDay(): "morning" | "afternoon" | "evening" | "night" {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

// Get greeting based on time
export function getGreeting(name: string): string {
  const timeOfDay = getTimeOfDay();
  const greetings = {
    morning: `Good morning, ${name}`,
    afternoon: `Good afternoon, ${name}`,
    evening: `Good evening, ${name}`,
    night: `Hello, ${name}`
  };
  return greetings[timeOfDay];
}
