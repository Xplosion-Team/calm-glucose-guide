import { useState, useCallback, useEffect } from "react";
import type { ChecklistItem } from "@/components/onboarding/OnboardingChecklist";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "calm-glucose-onboarding";

interface OnboardingState {
  tourCompleted: boolean;
  dismissed: boolean;
  hiddenForever: boolean;
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
    label: "Connect to your T1Pal",
    description: "Connect your T1Pal account so insights use your real CGM, insulin, and meal data. This is a required setup step.",
  },
];

function loadState(): OnboardingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        tourCompleted: !!parsed.tourCompleted,
        dismissed: !!parsed.dismissed,
        hiddenForever: !!parsed.hiddenForever,
        checklist: parsed.checklist ?? {},
      };
    }
  } catch {}
  return { tourCompleted: false, dismissed: false, hiddenForever: false, checklist: {} };
}

function saveState(state: OnboardingState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function persistHiddenToProfile(hidden: boolean) {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return;
    await (supabase as any)
      .from("profiles")
      .update({ onboarding_hidden: hidden })
      .eq("user_id", user.id);
  } catch {
    // best-effort; localStorage already holds the preference
  }
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(loadState);
  const [tourRunning, setTourRunning] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Hydrate hiddenForever from the user's profile (source of truth across devices)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (!user) {
          if (!cancelled) setProfileLoaded(true);
          return;
        }
        const { data } = await (supabase as any)
          .from("profiles")
          .select("onboarding_hidden")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (data?.onboarding_hidden) {
          setState((prev) => {
            const next = { ...prev, hiddenForever: true, dismissed: true };
            saveState(next);
            return next;
          });
        }
        setProfileLoaded(true);
      } catch {
        if (!cancelled) setProfileLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-start tour on first visit (only if not hidden and profile finished loading)
  useEffect(() => {
    if (!profileLoaded) return;
    if (state.hiddenForever || state.tourCompleted || state.dismissed) return;
    const timer = setTimeout(() => setTourRunning(true), 1500);
    return () => clearTimeout(timer);
  }, [profileLoaded, state.hiddenForever, state.tourCompleted, state.dismissed]);

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

  const hideForever = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, dismissed: true, hiddenForever: true };
      saveState(next);
      return next;
    });
    void persistHiddenToProfile(true);
  }, []);

  const resetOnboarding = useCallback(() => {
    const next: OnboardingState = {
      tourCompleted: false,
      dismissed: false,
      hiddenForever: false,
      checklist: {},
    };
    saveState(next);
    setState(next);
    void persistHiddenToProfile(false);
  }, []);

  const showChecklist = !state.hiddenForever && !state.dismissed;

  return {
    tourRunning,
    checklist,
    showChecklist,
    completeItem,
    finishTour,
    startTour,
    dismissChecklist,
    hideForever,
    resetOnboarding,
  };
}
