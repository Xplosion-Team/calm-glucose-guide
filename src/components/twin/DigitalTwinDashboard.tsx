import { useEffect, useMemo, useState } from "react";
import { Cpu, WifiOff } from "lucide-react";
import { BrainQuery } from "./BrainQuery";
import { TimelineChart } from "./TimelineChart";
import { checkHealth } from "@/lib/digital-twin-api";
import { useScreenContext } from "@/hooks/useScreenContext";

interface DigitalTwinDashboardProps {
  currentGlucose: number;
}

export function DigitalTwinDashboard({ currentGlucose }: DigitalTwinDashboardProps) {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    checkHealth().then(setOnline);
  }, []);

  useScreenContext(
    useMemo(
      () => ({
        screen: "Digital Twin",
        status:
          online === false
            ? "The Digital Twin is offline right now."
            : online === true
            ? `The Digital Twin is online. Your current glucose is ${currentGlucose}.`
            : `Checking the Digital Twin connection. Your current glucose is ${currentGlucose}.`,
        highlights:
          online === false
            ? ["The backend is unreachable. Predictions and questions will return shortly once it is back online."]
            : [
                "Ask the Twin a question about your glucose patterns.",
                "See a predicted timeline for the next two hours.",
                "The Twin uses your recent readings to model what is likely next.",
              ],
        data: { currentGlucose, online },
        fallback:
          online === false
            ? `You're on the Digital Twin screen. The Twin is offline right now, so predictions are paused. Want more detail?`
            : `You're on the Digital Twin screen. Your current glucose is ${currentGlucose}. You can ask the Twin a question or see a predicted timeline for the next two hours. Want more detail?`,
      }),
      [online, currentGlucose],
    ),
  );


  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 mb-2">
          <Cpu className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-semibold text-foreground">Digital Twin</h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Your personal glucose model — ask questions and see predictions.
        </p>
        {online !== null && (
          <span
            className={`inline-flex items-center gap-1.5 mt-2 text-xs font-medium px-3 py-1 rounded-full ${
              online ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            }`}
          >
            {online ? "● Twin online" : <><WifiOff className="w-3 h-3" /> Twin offline</>}
          </span>
        )}
      </div>

      {online === false && (
        <p className="text-center text-sm text-muted-foreground">
          The Digital Twin backend is currently unreachable. Please try again later.
        </p>
      )}

      {online !== false && (
        <>
          <BrainQuery currentGlucose={currentGlucose} />
          <div className="border-t pt-6">
            <TimelineChart currentGlucose={currentGlucose} />
          </div>
        </>
      )}

      {/* Disclaimer */}
      <div className="text-center pt-6 border-t">
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          This is for learning only. Always follow your care team's guidance
          for medication and treatment decisions.
        </p>
      </div>
    </div>
  );
}
