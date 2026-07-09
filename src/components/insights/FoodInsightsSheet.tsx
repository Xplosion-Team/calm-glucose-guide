import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Timer, Repeat, GitCompareArrows, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFoodLogs } from "@/hooks/useFoodLogs";
import { useAllMealResponses, scoreBand } from "@/hooks/useMealFeatures";
import { useI18n } from "@/i18n/I18nProvider";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface MealStat {
  label: string;
  count: number;
  avgRise: number;
  avgRecovery: number | null;
  avgScore: number;
}

export function FoodInsightsSheet({ open, onOpenChange }: Props) {
  const { lang } = useI18n();
  const { logs } = useFoodLogs();
  const { rows, loading } = useAllMealResponses();
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);

  const stats = useMemo<MealStat[]>(() => {
    if (rows.length === 0) return [];
    const byLog = new Map(logs.map((l) => [l.id, l]));
    const grouped = new Map<string, { rises: number[]; recs: number[]; scores: number[] }>();
    for (const r of rows) {
      const log = byLog.get(r.food_log_id);
      if (!log) continue;
      const key = log.label.trim().toLowerCase();
      if (!grouped.has(key)) grouped.set(key, { rises: [], recs: [], scores: [] });
      const bucket = grouped.get(key)!;
      if (r.glucose_rise != null) bucket.rises.push(Number(r.glucose_rise));
      if (r.recovery_time_min != null) bucket.recs.push(r.recovery_time_min);
      if (r.meal_score != null) bucket.scores.push(r.meal_score);
    }
    const out: MealStat[] = [];
    for (const [key, b] of grouped) {
      if (b.rises.length === 0) continue;
      const original = logs.find((l) => l.label.trim().toLowerCase() === key)?.label ?? key;
      out.push({
        label: original,
        count: b.rises.length,
        avgRise: b.rises.reduce((a, x) => a + x, 0) / b.rises.length,
        avgRecovery: b.recs.length ? b.recs.reduce((a, x) => a + x, 0) / b.recs.length : null,
        avgScore: b.scores.length ? b.scores.reduce((a, x) => a + x, 0) / b.scores.length : 0,
      });
    }
    return out;
  }, [rows, logs]);

  const smallestRise = useMemo(() => [...stats].sort((a, b) => a.avgRise - b.avgRise).slice(0, 3), [stats]);
  const largestRise = useMemo(() => [...stats].sort((a, b) => b.avgRise - a.avgRise).slice(0, 3), [stats]);
  const fastestRecovery = useMemo(() =>
    [...stats].filter((s) => s.avgRecovery != null).sort((a, b) => (a.avgRecovery ?? 999) - (b.avgRecovery ?? 999)).slice(0, 3),
    [stats]);
  const mostFrequent = useMemo(() => [...stats].sort((a, b) => b.count - a.count).slice(0, 3), [stats]);

  const insufficient = stats.length < 3;
  const compareOptions = [...stats].sort((a, b) => b.count - a.count);
  const a = stats.find((s) => s.label === compareA);
  const b = stats.find((s) => s.label === compareB);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {lang === "es" ? "Perspectivas de comida" : "Food Insights"}
          </SheetTitle>
        </SheetHeader>

        <div className="pt-4 pb-8 space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">{lang === "es" ? "Cargando…" : "Loading…"}</p>
          ) : insufficient ? (
            <Card className="glass-card border-0">
              <CardContent className="p-4 text-center space-y-1">
                <p className="text-base font-medium">
                  {lang === "es" ? "Aún necesitamos más historial" : "We need a bit more history"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lang === "es"
                    ? "Registra algunas comidas más con datos de glucosa para ver tus tendencias."
                    : "Log a few more meals with glucose data to see your trends."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <InsightGroup icon={TrendingDown} title={lang === "es" ? "Menor aumento de glucosa" : "Smallest glucose rise"} meals={smallestRise} formatValue={(m) => `+${m.avgRise.toFixed(0)} mg/dL`} />
              <InsightGroup icon={TrendingUp} title={lang === "es" ? "Mayor aumento de glucosa" : "Highest glucose rise"} meals={largestRise} formatValue={(m) => `+${m.avgRise.toFixed(0)} mg/dL`} />
              <InsightGroup icon={Timer} title={lang === "es" ? "Recuperación más rápida" : "Fastest recovery"} meals={fastestRecovery} formatValue={(m) => `${m.avgRecovery?.toFixed(0)} min`} />
              <InsightGroup icon={Repeat} title={lang === "es" ? "Más frecuentes" : "Most frequently eaten"} meals={mostFrequent} formatValue={(m) => `${m.count}×`} />

              <div className="pt-2 space-y-2">
                <h3 className="text-base font-semibold flex items-center gap-2"><GitCompareArrows className="w-4 h-4" />{lang === "es" ? "Comparar comidas" : "Compare meals"}</h3>
                <div className="grid grid-cols-2 gap-2">
                  <MealPicker options={compareOptions} value={compareA} onChange={setCompareA} label="A" />
                  <MealPicker options={compareOptions} value={compareB} onChange={setCompareB} label="B" />
                </div>
                {a && b && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <ComparisonCard stat={a} />
                    <ComparisonCard stat={b} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InsightGroup({ icon: Icon, title, meals, formatValue }: {
  icon: typeof TrendingDown; title: string; meals: MealStat[]; formatValue: (m: MealStat) => string;
}) {
  if (meals.length === 0) return null;
  return (
    <Card className="glass-card border-0">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="w-4 h-4" /> {title}
        </div>
        <div className="space-y-1.5">
          {meals.map((m) => (
            <div key={m.label} className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground truncate mr-2">{m.label}</span>
              <span className="text-primary font-semibold shrink-0">{formatValue(m)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MealPicker({ options, value, onChange, label }: {
  options: MealStat[]; value: string | null; onChange: (v: string) => void; label: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 rounded-xl border border-border bg-card px-3 text-sm"
      >
        <option value="">—</option>
        {options.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ComparisonCard({ stat }: { stat: MealStat }) {
  const band = scoreBand(Math.round(stat.avgScore));
  return (
    <Card className="glass-card border-0">
      <CardContent className="p-3 space-y-2">
        <p className="font-semibold truncate">{stat.label}</p>
        <div className="text-xs text-muted-foreground">Avg rise <span className="text-foreground font-medium">+{stat.avgRise.toFixed(0)}</span></div>
        <div className="text-xs text-muted-foreground">Recovery <span className="text-foreground font-medium">{stat.avgRecovery ? `${stat.avgRecovery.toFixed(0)}m` : "—"}</span></div>
        <div className="text-xs text-muted-foreground">Score <span className="text-foreground font-medium">{stat.avgScore.toFixed(0)}</span> {band && <span>{band.emoji}</span>}</div>
      </CardContent>
    </Card>
  );
}
