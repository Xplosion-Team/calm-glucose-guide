import { useState, useEffect, useCallback } from "react";
import type { GlucoseData, UserProfile, GlucoseReading } from "@/types/glucose";
import { interpretGlucose, getTimeOfDay } from "@/lib/glucose-interpreter";
import { supabase } from "@/integrations/supabase/client";

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

// Parse Dexcom EGV records into a GlucoseReading
function parseDexcomEgvs(records: any[]): GlucoseReading | null {
  if (!records || records.length < 2) return null;

  // Dexcom v3 EGV records: { value, systemTime, displayTime, trend, ... }
  // Sort by systemTime descending to get latest first
  const sorted = [...records].sort(
    (a, b) => new Date(b.systemTime || b.displayTime).getTime() - new Date(a.systemTime || a.displayTime).getTime()
  );

  const latest = sorted[0];
  const previous = sorted[1];

  const currentGlucose = latest.value ?? latest.glucoseValue;
  const previousGlucose = previous.value ?? previous.glucoseValue;

  if (currentGlucose == null || previousGlucose == null) return null;

  const latestTime = new Date(latest.systemTime || latest.displayTime);
  const previousTime = new Date(previous.systemTime || previous.displayTime);
  const timeDeltaMinutes = Math.max(1, (latestTime.getTime() - previousTime.getTime()) / 60000);

  const rateOfChange = (currentGlucose - previousGlucose) / timeDeltaMinutes;
  const predicted30min = Math.round(Math.max(40, Math.min(400, currentGlucose + rateOfChange * 30)));
  const predicted60min = Math.round(Math.max(40, Math.min(400, currentGlucose + rateOfChange * 60 * 0.7)));

  const timeOfDay = getTimeOfDay();

  return {
    currentGlucose,
    previousGlucose,
    timeDeltaMinutes,
    predictedGlucose30min: predicted30min,
    predictedGlucose60min: predicted60min,
    recentMeal: false, // Dexcom EGV data doesn't include meal info
    recentActivity: false,
    timeOfDay,
    timestamp: latestTime,
  };
}

async function fetchDexcomData(): Promise<GlucoseReading | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dexcom-data?endpoint=egvs`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      }
    );

    if (!res.ok) {
      console.warn("Dexcom data fetch failed:", res.status);
      return null;
    }

    const data = await res.json();
    const records = data.records || data.egvs || [];
    return parseDexcomEgvs(records);
  } catch (err) {
    console.warn("Dexcom data fetch error:", err);
    return null;
  }
}

export function useGlucoseData() {
  const [data, setData] = useState<GlucoseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDexcom, setIsDexcom] = useState(false);
  
  const refresh = useCallback(async () => {
    setIsLoading(true);
    
    // Check if Dexcom is connected
    const { data: tokenData } = await supabase
      .from("dexcom_tokens")
      .select("id")
      .maybeSingle();

    let reading: GlucoseReading;

    if (tokenData) {
      const dexcomReading = await fetchDexcomData();
      if (dexcomReading) {
        reading = dexcomReading;
        setIsDexcom(true);
      } else {
        reading = generateDemoReading();
        setIsDexcom(false);
      }
    } else {
      reading = generateDemoReading();
      setIsDexcom(false);
    }

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
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);
  
  return { data, isLoading, refresh, isDexcom };
}
