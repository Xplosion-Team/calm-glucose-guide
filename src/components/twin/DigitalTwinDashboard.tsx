import { useEffect, useState } from "react";
import { Cpu, WifiOff } from "lucide-react";
import { BrainQuery } from "./BrainQuery";
import { TimelineChart } from "./TimelineChart";
import { checkHealth } from "@/lib/digital-twin-api";

interface DigitalTwinDashboardProps {
  currentGlucose: number;
}

export function DigitalTwinDashboard({ currentGlucose }: DigitalTwinDashboardProps) {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    checkHealth().then(setOnline);
  }, []);

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
