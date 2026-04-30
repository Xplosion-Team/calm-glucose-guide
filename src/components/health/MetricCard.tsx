import { Activity, Droplet, HeartPulse, Moon, Scale } from "lucide-react";
import type { HealthMetricSummary, HealthMetricType } from "@/types/health";

const META: Record<
  HealthMetricType,
  { label: string; Icon: typeof Activity; format: (v: number) => string }
> = {
  blood_glucose: {
    label: "Blood glucose",
    Icon: Droplet,
    format: (v) => `${Math.round(v)} mg/dL`,
  },
  step_count: {
    label: "Steps today",
    Icon: Activity,
    format: (v) => `${Math.round(v).toLocaleString()}`,
  },
  heart_rate: {
    label: "Heart rate",
    Icon: HeartPulse,
    format: (v) => `${Math.round(v)} bpm`,
  },
  body_mass: {
    label: "Weight",
    Icon: Scale,
    format: (v) => `${v.toFixed(1)} kg`,
  },
  sleep_analysis: {
    label: "Sleep last night",
    Icon: Moon,
    format: (v) => {
      const h = Math.floor(v / 60);
      const m = Math.round(v % 60);
      return `${h}h ${m}m`;
    },
  },
};

interface MetricCardProps {
  summary?: HealthMetricSummary;
  metric: HealthMetricType;
}

export function MetricCard({ summary, metric }: MetricCardProps) {
  const meta = META[metric];
  const { Icon, label, format } = meta;

  const headlineValue =
    metric === "step_count" || metric === "sleep_analysis"
      ? summary?.todayTotal
      : summary?.latest?.value;

  const sevenDay = summary?.sevenDayAverage;

  return (
    <div className="rounded-2xl bg-card border p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" aria-hidden="true" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      {headlineValue == null ? (
        <p className="text-base text-muted-foreground">No data yet</p>
      ) : (
        <p className="text-2xl font-semibold text-foreground">
          {format(headlineValue)}
        </p>
      )}
      {sevenDay != null && headlineValue != null && (
        <p className="text-xs text-muted-foreground">
          7-day avg: {format(sevenDay)}
        </p>
      )}
    </div>
  );
}
