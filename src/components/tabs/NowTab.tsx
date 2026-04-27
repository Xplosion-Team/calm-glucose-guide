import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlucoseDisplay } from "@/components/GlucoseDisplay";
import { MessageCard } from "@/components/MessageCard";
import { SuggestionCard } from "@/components/SuggestionCard";
import { TimeInfo } from "@/components/TimeInfo";
import { PredictionPreview } from "@/components/PredictionPreview";
import { useScreenContext } from "@/hooks/useScreenContext";
import type { GlucoseData } from "@/types/glucose";

interface NowTabProps {
  data: GlucoseData;
  isDexcom: boolean;
  onRefresh: () => void;
}

export function NowTab({ data, isDexcom, onRefresh }: NowTabProps) {
  const {
    currentGlucose,
    predictedGlucose30min,
    predictedGlucose60min,
    recentMeal,
    recentActivity,
    timestamp,
    interpretation,
  } = data;

  useScreenContext(
    useMemo(
      () => ({
        screen: "Now",
        status: `Your glucose is ${currentGlucose} mg/dL — ${interpretation.state}.`,
        highlights: [
          interpretation.message,
          interpretation.suggestion ?? "",
          `In about 30 minutes you're likely around ${predictedGlucose30min} mg/dL.`,
          `In an hour, around ${predictedGlucose60min} mg/dL.`,
          recentMeal ? `Recent meal: ${recentMeal}.` : "",
          recentActivity ? `Recent activity: ${recentActivity}.` : "",
          isDexcom ? "Live Dexcom data is connected." : "Showing demo data — connect your CGM for live readings.",
        ].filter(Boolean) as string[],
        data: {
          currentGlucose,
          predicted30: predictedGlucose30min,
          predicted60: predictedGlucose60min,
          state: interpretation.state,
          urgency: interpretation.urgency,
          isDexcom,
        },
        fallback: `You're on the Now screen. Your glucose is ${currentGlucose} milligrams per deciliter, ${interpretation.state.toLowerCase()}. ${interpretation.message} Want more detail?`,
      }),
      [
        currentGlucose,
        predictedGlucose30min,
        predictedGlucose60min,
        recentMeal,
        recentActivity,
        interpretation.state,
        interpretation.urgency,
        interpretation.message,
        interpretation.suggestion,
        isDexcom,
      ],
    ),
  );


  return (
    <>
      <div
        className="flex flex-col items-center py-8 animate-fade-in-delay-1"
        data-tour="glucose-display"
      >
        <GlucoseDisplay
          value={currentGlucose}
          state={interpretation.state}
          urgency={interpretation.urgency}
        />
        <div className="w-full mt-6" data-tour="predictions">
          <PredictionPreview
            current={currentGlucose}
            predicted30={predictedGlucose30min}
            predicted60={predictedGlucose60min}
          />
        </div>
        <div className="mt-4">
          <TimeInfo
            timestamp={timestamp}
            recentMeal={recentMeal}
            recentActivity={recentActivity}
          />
        </div>
      </div>

      <div className="space-y-4 animate-fade-in-delay-2" data-tour="message-card">
        <MessageCard message={interpretation.message} />
        {interpretation.suggestion && (
          <div className="animate-fade-in-delay-3">
            <SuggestionCard suggestion={interpretation.suggestion} />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 mt-8 animate-fade-in-delay-3">
        <span
          className={`text-xs font-medium px-3 py-1 rounded-full ${
            isDexcom
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isDexcom ? "● Live Dexcom data" : "● Demo data"}
        </span>
        <Button
          variant="outline"
          onClick={onRefresh}
          className="touch-target gap-2"
        >
          <RefreshCw className="w-5 h-5" aria-hidden="true" />
          Check again
        </Button>
      </div>
    </>
  );
}
