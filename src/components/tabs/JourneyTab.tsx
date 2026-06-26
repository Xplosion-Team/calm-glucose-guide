import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Calendar, Flame, TrendingUp, Sparkles, Activity, PlusCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useScreenContext } from "@/hooks/useScreenContext";
import { TrainingCard } from "@/components/journey/TrainingCard";
import { useProgressStats, type ProgressMilestone } from "@/hooks/useProgressStats";

interface JourneyTabProps {
  currentGlucose: number;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "Last week";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function iconForMilestone(kind: ProgressMilestone["kind"]) {
  switch (kind) {
    case "account":
      return Calendar;
    case "t1pal":
      return Activity;
    case "streak":
      return Flame;
    case "log":
    default:
      return Sparkles;
  }
}

function toneForMilestone(kind: ProgressMilestone["kind"]): "primary" | "rising" | "stable" {
  if (kind === "t1pal") return "rising";
  if (kind === "streak") return "stable";
  return "primary";
}

export function JourneyTab({ currentGlucose: _ }: JourneyTabProps) {
  const stats = useProgressStats();

  const hasT1pal = !!stats.t1palConnectedAt;
  const hasAnyLogs = stats.totalLogs > 0 || stats.totalReadings > 0;
  const goalProgress = stats.timeInRangePct ?? 0;

  useScreenContext(
    useMemo(
      () => ({
        screen: "Progress",
        status: hasAnyLogs
          ? `You've tracked ${stats.daysTracked} day${stats.daysTracked === 1 ? "" : "s"} so far.` +
            (stats.timeInRangePct != null ? ` Time in range is ${stats.timeInRangePct}%.` : "")
          : "No tracking data yet. Connect T1Pal or log your first entry to begin.",
        highlights: [
          stats.bestStreakDays > 0 ? `Best streak: ${stats.bestStreakDays} day${stats.bestStreakDays === 1 ? "" : "s"}.` : "No streak yet — log today to start one.",
          stats.avgGlucose != null ? `Average glucose (last 14 days): ${stats.avgGlucose}.` : "Average glucose: not enough data yet.",
          hasT1pal ? "T1Pal is connected." : "T1Pal is not connected yet.",
        ],
        data: {
          daysTracked: stats.daysTracked,
          timeInRange: stats.timeInRangePct,
          avgGlucose: stats.avgGlucose,
          bestStreakDays: stats.bestStreakDays,
          totalLogs: stats.totalLogs,
          totalReadings: stats.totalReadings,
          hasT1pal,
        },
        fallback: hasAnyLogs
          ? `You're on the Progress screen. You've tracked ${stats.daysTracked} days so far.`
          : `You're on the Progress screen. There's no data yet — connect T1Pal or log your first entry to get started.`,
      }),
      [stats.daysTracked, stats.timeInRangePct, stats.avgGlucose, stats.bestStreakDays, stats.totalLogs, stats.totalReadings, hasT1pal, hasAnyLogs],
    ),
  );

  if (stats.loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground animate-fade-in">
        <Loader2 className="w-8 h-8 animate-spin mb-3" aria-hidden="true" />
        <p className="text-sm">Loading your progress…</p>
      </div>
    );
  }

  if (stats.error) {
    return (
      <Card className="glass-card border-0 animate-fade-in">
        <CardContent className="p-6 text-center space-y-2">
          <p className="font-semibold text-foreground">We couldn&apos;t load your progress</p>
          <p className="text-sm text-muted-foreground">{stats.error}</p>
          <Button onClick={() => stats.refresh()} variant="outline" size="sm" className="mt-2">
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const fmt = (v: number | null, suffix = "") => (v == null ? "—" : `${v}${suffix}`);

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      {/* Hero */}
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 mb-2">
          <TrendingUp className="w-6 h-6 text-primary" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-foreground">Your Journey</h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          A gentle look at how far you&apos;ve come.
        </p>
      </div>

      {/* Training plan */}
      <TrainingCard />

      {/* Empty-state CTAs */}
      {(!hasT1pal || !hasAnyLogs) && (
        <Card className="glass-card border-0">
          <CardContent className="p-5 space-y-3">
            <h3 className="text-base font-semibold text-foreground">Get started</h3>
            {!hasT1pal && (
              <div className="flex items-start gap-3">
                <Activity className="w-5 h-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Connect T1Pal</p>
                  <p className="text-sm text-muted-foreground">
                    Pull your real CGM, insulin, and meal data into your dashboard.
                  </p>
                  <Button asChild size="sm" className="mt-2">
                    <Link to="/settings/t1pal">Connect T1Pal</Link>
                  </Button>
                </div>
              </div>
            )}
            {!hasAnyLogs && (
              <div className="flex items-start gap-3">
                <PlusCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Log your first entry</p>
                  <p className="text-sm text-muted-foreground">
                    Add a meal, drink, or medication from the Today tab to start tracking.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats grid — real numbers, "—" when no data */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="glass-card border-0">
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-foreground tracking-tight">{stats.daysTracked}</p>
            <p className="text-sm text-muted-foreground mt-1">Days tracked</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0">
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-foreground tracking-tight">{fmt(stats.timeInRangePct, "%")}</p>
            <p className="text-sm text-muted-foreground mt-1">Time in range</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0">
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-foreground tracking-tight">{fmt(stats.avgGlucose)}</p>
            <p className="text-sm text-muted-foreground mt-1">Avg. glucose</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0">
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-foreground tracking-tight">
              {stats.bestStreakDays > 0 ? `${stats.bestStreakDays}d` : "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Best streak</p>
          </CardContent>
        </Card>
      </div>

      {/* Goal — only shown when there's real TIR data */}
      {stats.timeInRangePct != null ? (
        <Card className="glass-card border-0">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Weekly goal</h3>
              <span className="text-sm font-medium text-primary">{goalProgress}% / 80%</span>
            </div>
            <Progress value={goalProgress} className="h-2" />
            <p className="text-sm text-muted-foreground">
              {goalProgress >= 80
                ? "You're meeting your weekly goal. Beautiful work."
                : "Aim to stay in range about 80% of the day this week."}
            </p>
          </CardContent>
        </Card>
      ) : hasT1pal ? (
        <Card className="glass-card border-0">
          <CardContent className="p-5 text-sm text-muted-foreground">
            We&apos;ll show your time-in-range goal as soon as T1Pal sends a few more readings.
          </CardContent>
        </Card>
      ) : null}

      {/* Milestones — real history */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground px-1">Milestones</h3>
        {stats.milestones.length === 0 ? (
          <Card className="glass-card border-0">
            <CardContent className="p-5 text-sm text-muted-foreground text-center">
              Your milestones will appear here as you log entries and connect your data.
            </CardContent>
          </Card>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {stats.milestones.map((m) => {
              const Icon = iconForMilestone(m.kind);
              const tone = toneForMilestone(m.kind);
              const toneClass =
                tone === "rising"
                  ? "bg-status-rising-bg text-status-rising"
                  : tone === "stable"
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
                          <p className="text-xs text-muted-foreground">{formatRelativeDate(m.at)}</p>
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
        )}
      </div>

      <p className="text-center text-sm text-muted-foreground max-w-sm mx-auto pt-4 border-t">
        Your journey grows with every reading. Keep going at your own pace.
      </p>
    </div>
  );
}

