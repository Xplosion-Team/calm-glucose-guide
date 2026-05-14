import { useState, useEffect, useCallback } from "react";
import Joyride, { Step, CallBackProps, STATUS, EVENTS } from "react-joyride";

type TourTabId = "journey" | "twin" | "health" | "explore";

interface OnboardingTourProps {
  run: boolean;
  onFinish: () => void;
  activeTab: TourTabId;
  onChangeTab: (tab: TourTabId) => void;
}

const NOW_STEPS: Step[] = [
  {
    target: '[data-tour="header"]',
    content:
      "Welcome to Calm Glucose Guide — a calm, supportive companion built for adults living with type 2 diabetes.",
    title: "Welcome",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="dexcom"]',
    content:
      "Connect Apple Health (and your CGM if you wear one) so the app can learn from your activity, sleep, and glucose. You can also use it without connecting anything.",
    title: "Connect your data",
    placement: "bottom",
  },
  {
    target: '[data-tour="tab-journey"]',
    content:
      "Your Journey holds Today (log your meals), Now (your latest glucose), and Progress (how the week is going).",
    title: "Journey",
    placement: "top",
  },
  {
    target: '[data-tour="tab-health"]',
    content:
      "Your Circle is for the family or care team you choose to share gentle updates with — never automatic, always your choice.",
    title: "Your Circle",
    placement: "top",
  },
  {
    target: '[data-tour="tab-explore"]',
    content:
      "Explore has two gentle tools: 'What If…' for quick questions about meals, walks, or sleep, and Insights for an after-meal forecast.",
    title: "Explore",
    placement: "top-end",
  },
];

export function OnboardingTour({ run, onFinish, activeTab, onChangeTab }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);

  // Reset step index when tour restarts
  useEffect(() => {
    if (run) setStepIndex(0);
  }, [run]);

  const handleCallback = useCallback((data: CallBackProps) => {
    const { status, type, index } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      onFinish();
      return;
    }

    if (type === EVENTS.STEP_AFTER) {
      setStepIndex(index + 1);
    }
  }, [onFinish]);

  // Ensure we're on the Journey tab when tour is running
  useEffect(() => {
    if (run && activeTab !== "journey") {
      onChangeTab("journey");
    }
  }, [run, activeTab, onChangeTab]);

  return (
    <Joyride
      steps={NOW_STEPS}
      run={run}
      stepIndex={stepIndex}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      disableOverlayClose
      callback={handleCallback}
      locale={{
        back: "Back",
        close: "Close",
        last: "Got it!",
        next: "Next",
        skip: "Skip tour",
      }}
      styles={{
        options: {
          arrowColor: "hsl(80, 30%, 99%)",
          backgroundColor: "hsl(80, 30%, 99%)",
          primaryColor: "hsl(150, 35%, 32%)",
          textColor: "hsl(150, 20%, 18%)",
          overlayColor: "rgba(0, 0, 0, 0.45)",
          zIndex: 1000,
          width: Math.min(340, window.innerWidth - 32),
        },
        tooltip: {
          borderRadius: "1rem",
          padding: "1rem",
          fontSize: "0.95rem",
          maxWidth: "calc(100vw - 2rem)",
        },
        tooltipTitle: {
          fontSize: "1.15rem",
          fontWeight: 600,
          marginBottom: "0.5rem",
        },
        tooltipContent: {
          lineHeight: 1.6,
          padding: "0.5rem 0",
        },
        buttonNext: {
          borderRadius: "0.75rem",
          padding: "0.6rem 1.5rem",
          fontSize: "0.95rem",
          fontWeight: 600,
        },
        buttonBack: {
          color: "hsl(150, 10%, 45%)",
          fontSize: "0.9rem",
        },
        buttonSkip: {
          color: "hsl(150, 10%, 45%)",
          fontSize: "0.85rem",
        },
        spotlight: {
          borderRadius: "1rem",
        },
      }}
    />
  );
}
