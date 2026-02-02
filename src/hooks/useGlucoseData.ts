import { useState, useEffect, useCallback } from "react";
import type { GlucoseData, UserProfile, GlucoseReading } from "@/types/glucose";
import { interpretGlucose, getTimeOfDay } from "@/lib/glucose-interpreter";

// Demo user profile
const demoProfile: UserProfile = {
  age: 72,
  language: "English",
  culture: "US",
  preferredFoods: ["home-cooked", "comfort food"],
  mobilityLevel: "moderate",
  name: "Martha"
};

// Generate realistic demo glucose reading
function generateDemoReading(): GlucoseReading {
  const timeOfDay = getTimeOfDay();
  const hour = new Date().getHours();
  
  // Simulate typical glucose patterns
  let baseGlucose: number;
  let recentMeal = false;
  
  // Morning tends to be higher (dawn phenomenon)
  if (hour >= 5 && hour < 8) {
    baseGlucose = 110 + Math.random() * 30;
  }
  // Post-breakfast
  else if (hour >= 8 && hour < 10) {
    baseGlucose = 130 + Math.random() * 40;
    recentMeal = true;
  }
  // Late morning
  else if (hour >= 10 && hour < 12) {
    baseGlucose = 100 + Math.random() * 25;
  }
  // Post-lunch
  else if (hour >= 12 && hour < 14) {
    baseGlucose = 140 + Math.random() * 35;
    recentMeal = true;
  }
  // Afternoon
  else if (hour >= 14 && hour < 17) {
    baseGlucose = 105 + Math.random() * 30;
  }
  // Post-dinner
  else if (hour >= 17 && hour < 20) {
    baseGlucose = 130 + Math.random() * 40;
    recentMeal = hour >= 18;
  }
  // Evening/Night
  else {
    baseGlucose = 95 + Math.random() * 25;
  }
  
  const currentGlucose = Math.round(baseGlucose);
  const previousGlucose = Math.round(currentGlucose + (Math.random() * 20 - 10));
  
  // Predictions based on current trend and meal status
  const trend = (currentGlucose - previousGlucose) / 5;
  const predicted30min = Math.round(currentGlucose + trend * 6 + (Math.random() * 10 - 5));
  const predicted60min = Math.round(currentGlucose + trend * 8 + (Math.random() * 15 - 7.5));
  
  return {
    currentGlucose,
    previousGlucose,
    timeDeltaMinutes: 5,
    predictedGlucose30min: Math.max(60, Math.min(250, predicted30min)),
    predictedGlucose60min: Math.max(60, Math.min(250, predicted60min)),
    recentMeal,
    recentActivity: Math.random() > 0.7,
    timeOfDay,
    timestamp: new Date()
  };
}

export function useGlucoseData() {
  const [data, setData] = useState<GlucoseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const refresh = useCallback(() => {
    setIsLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      const reading = generateDemoReading();
      const interpretation = interpretGlucose(reading, demoProfile);
      
      setData({
        ...reading,
        interpretation,
        userProfile: demoProfile
      });
      setIsLoading(false);
    }, 500);
  }, []);
  
  useEffect(() => {
    refresh();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);
  
  return { data, isLoading, refresh };
}
