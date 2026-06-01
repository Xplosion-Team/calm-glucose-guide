import type { MedClass } from "@/hooks/useMedications";

export interface ActiveMedication {
  name: string;
  med_class: MedClass;
  takenMinutesAgo: number;
  dose: number | null;
}

export interface MedicationContext {
  /** Any fast-acting glucose-lowering medication is still on board. */
  activeFastLowering: boolean;
  /** Long-acting baseline support active. */
  baselineActive: boolean;
  /** Should we raise the floor on hypo risk because of recent meds? */
  hypoRiskBoost: boolean;
  /** Plain-English notes for the message layer. */
  notes: string[];
  active: ActiveMedication[];
}

const FAST_LOWERING: MedClass[] = ["rapid_insulin", "sulfonylurea"];
const BASELINE: MedClass[] = ["long_insulin", "metformin", "glp1", "sglt2", "dpp4"];

// How long (in minutes) a med is considered "on board" for messaging purposes.
const DURATION_MIN: Record<MedClass, number> = {
  rapid_insulin: 240,
  sulfonylurea: 360,
  long_insulin: 24 * 60,
  metformin: 12 * 60,
  glp1: 24 * 60,
  sglt2: 24 * 60,
  dpp4: 24 * 60,
  other: 240,
};

const FRIENDLY: Record<MedClass, string> = {
  rapid_insulin: "fast-acting insulin",
  long_insulin: "long-acting insulin",
  sulfonylurea: "your sulfonylurea pill",
  metformin: "metformin",
  glp1: "your GLP-1 medication",
  sglt2: "your SGLT2 medication",
  dpp4: "your DPP-4 medication",
  other: "your medication",
};

export function assessMedicationContext(active: ActiveMedication[]): MedicationContext {
  const notes: string[] = [];
  let activeFastLowering = false;
  let baselineActive = false;
  let hypoRiskBoost = false;

  for (const m of active) {
    const window = DURATION_MIN[m.med_class] ?? 240;
    if (m.takenMinutesAgo > window) continue;

    if (FAST_LOWERING.includes(m.med_class)) {
      activeFastLowering = true;
      // Peak risk window for hypoglycemia from fast-acting agents.
      if (m.takenMinutesAgo >= 30 && m.takenMinutesAgo <= 180) hypoRiskBoost = true;
      notes.push(
        `${FRIENDLY[m.med_class]} taken about ${Math.round(m.takenMinutesAgo)} minutes ago is still working.`,
      );
    } else if (BASELINE.includes(m.med_class)) {
      baselineActive = true;
      notes.push(`${FRIENDLY[m.med_class]} is part of today's routine.`);
    }
  }

  return { activeFastLowering, baselineActive, hypoRiskBoost, notes, active };
}
