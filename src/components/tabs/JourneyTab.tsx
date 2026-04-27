import { useMemo } from "react";
import { Award, Calendar, Flame, TrendingUp, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useScreenContext } from "@/hooks/useScreenContext";

interface JourneyTabProps {
  currentGlucose: number;
}

interface Milestone {
  id: string;
  date: string;
  title: string;
  detail: string;
  icon: typeof Award;
  tone: "primary" | "rising" | "stable";
}

const MILESTONES: Milestone[] = [
  {
    id: "1",
    date: "Today",
    title: "7-day streak in range",
    detail: "You've stayed in your healthy zone for a full week. Beautiful work.",
    icon: Flame,
    tone: "rising",
  },
  {
    id: "2",
    date: "3 days ago",
    title: "Smoothest morning yet",
    detail: "Your fasting reading was the steadiest it's been in 30 days.",
    icon: Sparkles,
    tone: "stable",
  },
  {
    id: "3",
    date: "Last week",
    title: "First Dexcom sync",
    detail: "You connected your CGM — your insights just got a lot richer.",
    icon: Award,
    tone: "primary",
  },
  {
    id: "4",
    date: "2 weeks ago",
    title: "Started your journey",
    detail: "Welcome to Greens Health. Every reading is a step forward.",
    icon: Calendar,
    tone: "primary",
  },
];

const STATS = [
  { label: "Days tracked", value: "14" },
  { label: "Time in range", value: "78%" },
  { label: "Avg. glucose", value: "118" },
  { label: "Best streak", value: "7d" },
];

export function JourneyTab({ currentGlucose: _ }: JourneyTabProps) {
  const goalProgress = 78; // % time in range — matches STATS

  useScreenContext(
    useMemo(
      () => ({
        screen: "Progress",
        status: `You've been tracking for 14 days, with 78 percent of time in range — your weekly goal is 80.`,
        highlights: [
          "You're on a 7-day streak inside your healthy zone.",
          "Your average glucose this period is around 118.",
          "Your best streak so far is 7 days.",
          "Recent milestone: smoothest fasting reading in 30 days.",
        ],
        data: { daysTracked: 14, timeInRange: 78, avgGlucose: 118, bestStreak: "7d", goalProgress },
        fallback: `You're on the Progress screen. You've been tracking for fourteen days, and you're in range about seventy-eight percent of the time — almost at your weekly goal of eighty. You're on a seven-day streak. Want more detail?`,
      }),
      [],
    ),
  );

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      {/* Hero */}
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 mb-2">
          <TrendingUp className="w-6 h-6 text-primary" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-foreground">Your Journey</h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          A gentle look at how far you've come.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {STATS.map((s) => (
          <Card key={s.label} className="glass-card border-0">
            <CardContent className="p-4">
              <p className="text-3xl font-bold text-foreground tracking-tight">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Goal */}
      <Card className="glass-card border-0">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Weekly goal</h3>
            <span className="text-sm font-medium text-primary">{goalProgress}% / 80%</span>
          </div>
          <Progress value={goalProgress} className="h-2" />
          <p className="text-sm text-muted-foreground">
            Stay in range 80% of the day this week. You're nearly there.
          </p>
        </CardContent>
      </Card>

      {/* Timeline */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground px-1">Milestones</h3>
        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {MILESTONES.map((m) => {
            const Icon = m.icon;
            const toneClass =
              m.tone === "rising"
                ? "bg-status-rising-bg text-status-rising"
                : m.tone === "stable"
                ? "bg-status-stable-bg text-status-stable"
                : "bg-primary/10 text-primary";
            return (
              <div key={m.id} className="relative">
                <span
                  className={`absolute -left-[18px] top-3 w-4 h-4 rounded-full ring-4 ring-background ${toneClass}`}
                  aria-hidden="true"
                />
                <Card className="glass-card border-0">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${toneClass}`}>
                        <Icon className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">{m.date}</p>
                        <p className="font-semibold text-foreground mt-0.5">{m.title}</p>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{m.detail}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground max-w-sm mx-auto pt-4 border-t">
        Your journey grows with every reading. Keep going at your own pace.
      </p>
    </div>
  );
}
