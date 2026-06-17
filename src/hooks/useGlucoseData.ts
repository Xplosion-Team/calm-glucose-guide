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
    timestamp: new Date(),
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

    // Prefer Nightscout/Dexcom data stored in cgm_readings.
    let reading: GlucoseReading | null = null;
    let isLive = false;
    try {
      // Trigger Nightscout + T1Pal syncs so "Check again" pulls the
      // freshest readings before we query cgm_readings. Best-effort:
      // failures are ignored so demo/fallback data still works.
      await Promise.allSettled([
        supabase.functions.invoke("nightscout-sync", { body: {} }),
        supabase.functions.invoke("sync-t1pal-readings", { body: {} }),
      ]);

      const { data: cgm } = await supabase
        .from("cgm_readings")
        .select("mg_dl, ts")
        .order("ts", { ascending: false })
        .limit(2);

      if (cgm && cgm.length >= 1) {
        const latest = cgm[0];
        const prev = cgm[1] ?? cgm[0];
        const latestTs = new Date(latest.ts).getTime();
        const prevTs = new Date(prev.ts).getTime();
        const deltaMin = Math.max(1, (latestTs - prevTs) / 60000);
        const current = Math.round(Number(latest.mg_dl));
        const previous = Math.round(Number(prev.mg_dl));
        const rate = (current - previous) / deltaMin;
        reading = {
          currentGlucose: current,
          previousGlucose: previous,
          timeDeltaMinutes: deltaMin,
          predictedGlucose30min: Math.round(Math.max(40, Math.min(400, current + rate * 30))),
          predictedGlucose60min: Math.round(Math.max(40, Math.min(400, current + rate * 60 * 0.7))),
          recentMeal: false,
          recentActivity: false,
          timeOfDay: getTimeOfDay(),
          timestamp: new Date(),
        };
        isLive = true;
      }
    } catch (err) {
      console.warn("cgm_readings fetch error:", err);
    }

    if (!reading) {
      const hk = await fetchHealthKitGlucose();
      if (hk.reading) {
        reading = hk.reading;
        isLive = hk.isLive;
      }
    }
    if (!reading) reading = generateDemoReading();
    setIsDexcom(isLive);

    // Pull recent medication events (last 24h) so the interpreter can
    // factor in insulin / oral agents that are still working.
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: evs } = await supabase
        .from("medication_events")
        .select("taken_at, dose, medication_id")
        .gte("taken_at", since)
        .order("taken_at", { ascending: false })
        .limit(20);
      if (evs && evs.length > 0) {
        const medIds = Array.from(new Set(evs.map((e) => e.medication_id)));
        const { data: meds } = await supabase
          .from("medications")
          .select("id, name, med_class")
          .in("id", medIds);
        const medMap = new Map((meds ?? []).map((m) => [m.id, m]));
        const now = Date.now();
        reading.recentMedications = evs
          .map((e) => {
            const m = medMap.get(e.medication_id);
            if (!m) return null;
            return {
              name: m.name,
              med_class: m.med_class as NonNullable<GlucoseReading["recentMedications"]>[number]["med_class"],
              takenMinutesAgo: Math.max(0, (now - new Date(e.taken_at).getTime()) / 60000),
              dose: e.dose,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
      }
    } catch (err) {
      console.warn("medication_events fetch error:", err);
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
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { data, isLoading, refresh, isDexcom };
}
