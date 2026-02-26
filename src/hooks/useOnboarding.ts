import { useState, useCallback, useEffect } from "react";
import type { ChecklistItem } from "@/components/onboarding/OnboardingChecklist";

const STORAGE_KEY = "calm-glucose-onboarding";

interface OnboardingState {
  tourCompleted: boolean;
  dismissed: boolean;
  checklist: Record<string, boolean>;
}

const DEFAULT_CHECKLIST: Omit<ChecklistItem, "completed">[] = [
  {
    id: "view_glucose",
    label: "View your glucose reading",
    description: "Check the main circle to see your current blood sugar level.",
  },
  {
    id: "check_predictions",
    label: "Check your predictions",
    description: "Look at the 30-min and 1-hour predictions below the circle.",
  },
  {
    id: "try_whatif",
    label: "Try a What-If scenario",
    description: "Go to the What If tab and simulate a meal or exercise.",
  },
  {
    id: "explore_twin",
    label: "Explore your Digital Twin",
    description: "Visit the Twin tab and ask a question about your glucose.",
  },
  {
    id: "connect_dexcom",
    label: "Connect Dexcom (optional)",
    description: "Link your CGM for real-time data instead of demo values.",
  },
];

function loadState(): OnboardingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { tourCompleted: false, dismissed: false, checklist: {} };
}

function saveState(state: OnboardingState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(loadState);
  const [tourRunning, setTourRunning] = useState(false);

  // Auto-start tour on first visit
  useEffect(() => {
    if (!state.tourCompleted && !state.dismissed) {
      const timer = setTimeout(() => setTourRunning(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checklist: ChecklistItem[] = DEFAULT_CHECKLIST.map((item) => ({
    ...item,
    completed: !!state.checklist[item.id],
  }));

  const completeItem = useCallback((id: string) => {
    setState((prev) => {
      const next = { ...prev, checklist: { ...prev.checklist, [id]: true } };
      saveState(next);
      return next;
    });
  }, []);

  const finishTour = useCallback(() => {
    setTourRunning(false);
    setState((prev) => {
      const next = {
        ...prev,
        tourCompleted: true,
        checklist: { ...prev.checklist, view_glucose: true, check_predictions: true },
      };
      saveState(next);
      return next;
    });
  }, []);

  const startTour = useCallback(() => {
    setTourRunning(true);
  }, []);

  const dismissChecklist = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, dismissed: true };
      saveState(next);
      return next;
    });
  }, []);

  const resetOnboarding = useCallback(() => {
    const next: OnboardingState = { tourCompleted: false, dismissed: false, checklist: {} };
    saveState(next);
    setState(next);
  }, []);

  const showChecklist = !state.dismissed || Object.values(state.checklist).some((v) => v);

  return {
    tourRunning,
    checklist,
    showChecklist,
    completeItem,
    finishTour,
    startTour,
    dismissChecklist,
    resetOnboarding,
  };
}
