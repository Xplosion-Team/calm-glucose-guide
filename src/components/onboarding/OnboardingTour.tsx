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
    content: "Welcome to Calm Glucose Guide! This is your personalised greeting and app header.",
    title: "👋 Welcome!",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="dexcom"]',
    content: "Connect your Dexcom CGM here to see real-time glucose data instead of demo values.",
    title: "📡 Connect Your Device",
    placement: "bottom",
  },
  {
    target: '[data-tour="glucose-display"]',
    content: "This is your current blood sugar reading. The colour and ring change based on your glucose state — green is stable, amber is rising, and so on.",
    title: "🎯 Glucose Reading",
    placement: "bottom",
  },
  {
    target: '[data-tour="predictions"]',
    content: "See where your glucose is heading in the next 30 and 60 minutes. Arrows show the trend direction.",
    title: "📈 Predictions",
    placement: "top",
  },
  {
    target: '[data-tour="message-card"]',
    content: "Your personal health message — a gentle interpretation of what your current reading means.",
    title: "💬 Your Message",
    placement: "top",
  },
  {
    target: '[data-tour="tab-journey"]',
    content: "Your Journey holds your current reading, What If scenarios, and your progress over time.",
    title: "🗺️ Journey Tab",
    placement: "top",
  },
  {
    target: '[data-tour="tab-twin"]',
    content: "Your Digital Twin — an AI model that learns your patterns and answers your glucose questions.",
    title: "🧠 Digital Twin Tab",
    placement: "top",
  },
  {
    target: '[data-tour="tab-explore"]',
    content: "Explore your Circles, play classic Games, and Learn — all in one place.",
    title: "🧭 Explore Tab",
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
