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
    label: "See your latest glucose",
    description: "Open the Now sub-tab on Journey to see your current reading and gentle interpretation.",
  },
  {
    id: "log_meal",
    label: "Log your first meal",
    description: "Open Today on Journey and add a meal — by photo, voice, or a few words. Logging meals is how the app learns your pattern.",
  },
  {
    id: "try_whatif",
    label: "Ask a What-If question",
    description: "On Explore › What If, pick a category like 'eat' or 'activity' and ask a gentle question.",
  },
  {
    id: "explore_twin",
    label: "See an after-meal forecast",
    description: "On Explore › Insights, enter a meal to see the predicted glucose response for the next few hours.",
  },
  {
    id: "connect_dexcom",
    label: "Connect Apple Health or your CGM (optional)",
    description: "Link Apple Health or Dexcom so insights use your real activity, sleep, and glucose instead of demo values.",
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
