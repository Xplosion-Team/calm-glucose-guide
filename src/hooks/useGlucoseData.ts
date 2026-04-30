import { useState, useEffect, useCallback } from "react";
import type { GlucoseData, UserProfile, GlucoseReading } from "@/types/glucose";
import { interpretGlucose, getTimeOfDay } from "@/lib/glucose-interpreter";
import { supabase } from "@/integrations/supabase/client";
import { getHealthProvider } from "@/services/health";
import type { HealthRecord } from "@/types/health";

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
  
  let baseGlucose: number;
  let recentMeal = false;
  
  if (hour >= 5 && hour < 8) {
    baseGlucose = 110 + Math.random() * 30;
  } else if (hour >= 8 && hour < 10) {
    baseGlucose = 130 + Math.random() * 40;
    recentMeal = true;
  } else if (hour >= 10 && hour < 12) {
    baseGlucose = 100 + Math.random() * 25;
  } else if (hour >= 12 && hour < 14) {
    baseGlucose = 140 + Math.random() * 35;
    recentMeal = true;
  } else if (hour >= 14 && hour < 17) {
    baseGlucose = 105 + Math.random() * 30;
  } else if (hour >= 17 && hour < 20) {
    baseGlucose = 130 + Math.random() * 40;
    recentMeal = hour >= 18;
  } else {
    baseGlucose = 95 + Math.random() * 25;
  }
  
  const currentGlucose = Math.round(baseGlucose);
  const previousGlucose = Math.round(currentGlucose + (Math.random() * 20 - 10));
  
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

// Convert HealthKit blood glucose records into a GlucoseReading.
function parseHealthKitGlucose(records: HealthRecord[]): GlucoseReading | null {
  if (!records || records.length < 2) return null;
  const sorted = [...records].sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime()
  );
  const latest = sorted[0];
  const previous = sorted[1];

  // HealthKit blood glucose may come in mmol/L; convert to mg/dL when needed.
  const toMgDl = (r: HealthRecord) =>
    r.unit?.toLowerCase().includes("mmol") ? r.value * 18 : r.value;

  const currentGlucose = Math.round(toMgDl(latest));
  const previousGlucose = Math.round(toMgDl(previous));
  const timeDeltaMinutes = Math.max(
    1,
    (latest.startDate.getTime() - previous.startDate.getTime()) / 60000
  );

  const rateOfChange = (currentGlucose - previousGlucose) / timeDeltaMinutes;
  const predicted30min = Math.round(
    Math.max(40, Math.min(400, currentGlucose + rateOfChange * 30))
  );
  const predicted60min = Math.round(
    Math.max(40, Math.min(400, currentGlucose + rateOfChange * 60 * 0.7))
  );

  return {
    currentGlucose,
    previousGlucose,
    timeDeltaMinutes,
    predictedGlucose30min: predicted30min,
    predictedGlucose60min: predicted60min,
    recentMeal: false,
    recentActivity: false,
    timeOfDay: getTimeOfDay(),
    timestamp: latest.startDate,
  };
}

async function fetchHealthKitGlucose(): Promise<{
  reading: GlucoseReading | null;
  isLive: boolean;
}> {
  try {
    const provider = await getHealthProvider();
    // Only treat AppleHealth as "live" — Demo provider stays on the demo flag.
    const records = await provider.read("blood_glucose", { limit: 24 });
    const reading = parseHealthKitGlucose(records);
    return { reading, isLive: provider.name === "AppleHealth" && !!reading };
  } catch (err) {
    console.warn("HealthKit glucose fetch error:", err);
    return { reading: null, isLive: false };
  }
}

export function useGlucoseData() {
  const [data, setData] = useState<GlucoseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Renamed conceptually to "isLive" but kept as isDexcom for backwards
  // compatibility with consumers (NowTab, Index) until they migrate.
  const [isDexcom, setIsDexcom] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    const { reading: hkReading, isLive } = await fetchHealthKitGlucose();
    const reading: GlucoseReading = hkReading ?? generateDemoReading();
    setIsDexcom(isLive);

    // Try to get user profile from database
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .maybeSingle();

    const userProfile: UserProfile = {
      ...demoProfile,
      name: profile?.display_name || demoProfile.name,
    };

    const interpretation = interpretGlucose(reading, userProfile);

    setData({
      ...reading,
      interpretation,
      userProfile,
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { data, isLoading, refresh, isDexcom };
}
