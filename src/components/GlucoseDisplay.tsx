import { cn } from "@/lib/utils";
import type { GlucoseState, UrgencyLevel } from "@/types/glucose";

interface GlucoseDisplayProps {
  value: number;
  state: GlucoseState;
  urgency: UrgencyLevel;
}

const stateStyles: Record<string, { bg: string; ring: string; text: string }> = {
  stable: {
    bg: "bg-status-stable-bg",
    ring: "ring-status-stable/30",
    text: "text-status-stable"
  },
  rising: {
    bg: "bg-status-rising-bg",
    ring: "ring-status-rising/30",
    text: "text-status-rising"
  },
  high: {
    bg: "bg-status-high-bg",
    ring: "ring-status-high/30",
    text: "text-status-high"
  },
  low: {
    bg: "bg-status-low-bg",
    ring: "ring-status-low/30",
    text: "text-status-low"
  }
};

function getStateCategory(state: GlucoseState): keyof typeof stateStyles {
  if (state.includes("Stable")) return "stable";
  if (state.includes("Rising")) return "rising";
  if (state.includes("High") || state.includes("Trending High")) return "high";
  if (state.includes("Low") || state.includes("Falling")) return "low";
  return "stable";
}

export function GlucoseDisplay({ value, state, urgency }: GlucoseDisplayProps) {
  const category = getStateCategory(state);
  const styles = stateStyles[category];
  
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Main glucose circle */}
      <div
        className={cn(
          "relative flex items-center justify-center",
          "w-56 h-56 rounded-full",
          styles.bg,
          "ring-4",
          styles.ring,
          urgency === "low" && "animate-gentle-pulse",
          "glucose-glow transition-all duration-700"
        )}
      >
        {/* Inner content */}
        <div className="text-center">
          <span className={cn("text-7xl font-bold tracking-tight", styles.text)}>
            {value}
          </span>
          <span className={cn("block text-xl font-medium mt-1", "text-muted-foreground")}>
            mg/dL
          </span>
        </div>
      </div>
      
      {/* State label */}
      <div
        className={cn(
          "px-5 py-2.5 rounded-full text-lg font-medium",
          styles.bg,
          styles.text
        )}
      >
        {state}
      </div>
    </div>
  );
}
