import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlucoseDisplay } from "@/components/GlucoseDisplay";
import { MessageCard } from "@/components/MessageCard";
import { SuggestionCard } from "@/components/SuggestionCard";
import { TimeInfo } from "@/components/TimeInfo";
import { PredictionPreview } from "@/components/PredictionPreview";
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
