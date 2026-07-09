import { useMemo, useState } from "react";
import { RefreshCw, FileText, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { T1PalConnectSection } from "@/components/settings/t1pal/T1PalSettingsPage";
import { MedicationsLinkCard } from "@/components/medications/MedicationsPage";
import { MetricCard } from "@/components/health/MetricCard";
import { HealthReportScreen } from "@/components/health/HealthReportScreen";
import { useHealthKit } from "@/hooks/useHealthKit";
import { DEFAULT_METRICS } from "@/services/health";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/I18nProvider";

export function HealthTab() {
  const { snapshot, isLoading, refresh, provider } = useHealthKit();
  const { lang } = useI18n();
  const [showReport, setShowReport] = useState(false);

  if (showReport) return <HealthReportScreen onBack={() => setShowReport(false)} />;

  const lastSyncLabel = useMemo(() => {
    if (!snapshot?.lastSyncAt) return "Not synced yet";
    return `Last updated ${snapshot.lastSyncAt.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }, [snapshot?.lastSyncAt]);

  const isDemo = provider?.name === "Demo";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">Your health today</h2>
        <p className="text-muted-foreground">
          A gentle picture of how your body is doing — connect T1Pal to keep
          your readings in sync.
        </p>
      </header>

      {/* Connect T1Pal */}
      <T1PalConnectSection />

      {/* Medications */}
      <MedicationsLinkCard />

      {/* Today summary */}
      <section aria-labelledby="today-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 id="today-heading" className="text-lg font-medium text-foreground">
            Today
          </h3>
          {snapshot && (
            <span
              className={`text-xs font-medium px-3 py-1 rounded-full ${
                isDemo
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {isDemo ? "● Demo data" : "● Live data"}
            </span>
          )}
        </div>
        {isLoading && !snapshot ? (
          <div className="grid grid-cols-2 gap-3">
            {DEFAULT_METRICS.map((m) => (
              <Skeleton key={m} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : snapshot && Object.keys(snapshot.metrics).length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {DEFAULT_METRICS.map((m) => (
              <MetricCard key={m} metric={m} summary={snapshot.metrics[m]} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            No readings yet. Once data comes in, it'll show up here.
          </p>
        )}
      </section>

      <div className="flex flex-col items-center gap-2 pt-2">
        <span className="text-xs text-muted-foreground">{lastSyncLabel}</span>
        <Button
          variant="outline"
          onClick={refresh}
          disabled={isLoading}
          className="touch-target gap-2"
        >
          <RefreshCw className="w-5 h-5" aria-hidden="true" />
          Sync now
        </Button>
      </div>
    </div>
  );
}
