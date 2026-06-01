import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MedClass =
  | "rapid_insulin"
  | "long_insulin"
  | "sulfonylurea"
  | "metformin"
  | "glp1"
  | "sglt2"
  | "dpp4"
  | "other";

export interface Medication {
  id: string;
  name: string;
  med_class: MedClass;
  dose: number | null;
  unit: string | null;
  started_at: string;
  stopped_at: string | null;
}

export interface MedicationEvent {
  id: string;
  medication_id: string;
  dose: number | null;
  taken_at: string;
  source: string;
}

export function useMedications() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [events, setEvents] = useState<MedicationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: m }, { data: e }] = await Promise.all([
      supabase
        .from("medications")
        .select("id,name,med_class,dose,unit,started_at,stopped_at")
        .is("stopped_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("medication_events")
        .select("id,medication_id,dose,taken_at,source")
        .order("taken_at", { ascending: false })
        .limit(50),
    ]);
    setMeds((m ?? []) as Medication[]);
    setEvents((e ?? []) as MedicationEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addMedication = useCallback(
    async (input: { name: string; med_class: MedClass; dose?: number; unit?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in to save medications.");
      const { error } = await supabase.from("medications").insert({
        user_id: auth.user.id,
        name: input.name,
        med_class: input.med_class,
        dose: input.dose ?? null,
        unit: input.unit ?? null,
      });
      if (error) throw error;
      await load();
    },
    [load],
  );

  const stopMedication = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("medications")
        .update({ stopped_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const logDose = useCallback(
    async (medicationId: string, dose?: number) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in to log a dose.");
      const { error } = await supabase.from("medication_events").insert({
        user_id: auth.user.id,
        medication_id: medicationId,
        dose: dose ?? null,
      });
      if (error) throw error;
      await load();
    },
    [load],
  );

  return { meds, events, loading, refresh: load, addMedication, stopMedication, logDose };
}
