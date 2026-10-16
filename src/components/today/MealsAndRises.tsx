import { useEffect, useMemo, useState } from "react";
import { Apple, Coffee, TrendingUp, HelpCircle, Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { EntryType } from "@/hooks/useFoodLogs";
import { useI18n } from "@/i18n/I18nProvider";
import { mealCurve, unmatchedRises, type Reading, type MealIn } from "@/lib/meal-glucose";
import { cn } from "@/lib/utils";

interface Props {
  onPick?: (draft: { type: EntryType; label: string; carbs_grams: number | null }) => void;
  onLogAt?: (at: Date) => void;
}

function Spark({ points, markAt, tone, big }: { points: Reading[]; markAt: number; tone: "meal" | "rise"; big?: boolean }) {
  if (points.length < 2) {
    return <div className={cn(big ? "h-32" : "h-14", "rounded-xl bg-muted/60 flex items-center justify-center text-xs text-muted-foreground")}>No sensor readings</div>;
  }
  const t0 = Math.min(...points.map((p) => p.t)), t1 = Math.max(...points.map((p) => p.t));
  const lo = Math.min(...points.map((p) => p.v)) - 10, hi = Math.max(...points.map((p) => p.v)) + 10;
  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * 100;
  const y = (v: number) => 40 - ((v - lo) / (hi - lo || 1)) * 36 - 2;
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const mx = Math.min(100, Math.max(0, x(markAt)));
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={cn("w-full", big ? "h-32" : "h-14")} aria-hidden>
      <line x1={mx} x2={mx} y1="0" y2="40" className="stroke-muted-foreground/40" strokeDasharray="2 2" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke"
        className={tone === "meal" ? "stroke-primary" : "stroke-status-rising"} />
    </svg>
  );
}

export function MealsAndRises({ onPick, onLogAt }: Props) {
  const { lang } = useI18n();
  const es = lang === "es";
  const [meals, setMeals] = useState<MealIn[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const [{ data: logs }, { data: cgm }] = await Promise.all([
        supabase.from("food_logs").select("id,label,type,carbs_grams,logged_at")
          .in("type", ["food", "drink"]).gte("logged_at", since).order("logged_at", { ascending: false }).limit(20),
        supabase.from("cgm_readings").select("ts,mg_dl").gte("ts", since).order("ts").limit(3000),
      ]);
      if (!alive) return;
      setMeals((logs ?? []).map((l) => ({ id: l.id, label: l.label, type: l.type, carbs: l.carbs_grams, at: Date.parse(l.logged_at) })));
      setReadings((cgm ?? []).map((c) => ({ t: Date.parse(c.ts), v: Number(c.mg_dl) })));
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  const curves = useMemo(() => meals.map((m) => mealCurve(m, readings)), [meals, readings]);
  const rises = useMemo(() => unmatchedRises(readings, meals).slice(0, 5), [readings, meals]);

  if (!loaded || (!curves.length && !rises.length)) return null;

  const when = (t: number) => {
    const d = new Date(t);
    const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5);
    const day = days === 0 ? (es ? "Hoy" : "Today") : days === 1 ? (es ? "Ayer" : "Yesterday")
      : d.toLocaleDateString(es ? "es-ES" : "en-US", { weekday: "short", month: "short", day: "numeric" });
    return `${day} · ${d.toLocaleTimeString(es ? "es-ES" : "en-US", { hour: "numeric", minute: "2-digit" })}`;
  };

  const renderCards = (big: boolean) => {
    const card = cn("text-left rounded-2xl border-2 bg-card p-3 space-y-2 touch-target transition-all", big ? "w-full p-4" : "shrink-0 w-60 snap-start");
    return (<>
        {rises.map((r) => (
          <button key={`rise-${r.start}`} onClick={() => { setExpanded(false); onLogAt?.(new Date(r.start)); }}
            className={cn(card, "border-status-rising/50 bg-status-rising-bg/40 hover:border-status-rising")}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-status-rising-bg text-status-rising flex items-center justify-center">
                <HelpCircle className="w-4 h-4" />
              </div>
              <p className="font-medium text-foreground text-sm">{es ? "¿Comiste algo?" : "Did you eat something?"}</p>
            </div>
            <p className="text-xs text-muted-foreground">{when(r.start)}</p>
            <Spark points={r.points} markAt={r.start} tone="rise" big={big} />
            <p className="text-sm text-status-rising font-medium flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> {es ? "Subió" : "Rose"} ~{Math.round(r.peak - r.startValue)} {es ? "sin comida anotada" : "with no meal logged"}
            </p>
            <p className="text-xs text-primary font-medium">{es ? "Toca para anotar una comida" : "Tap to log a meal for this time"}</p>
          </button>
        ))}

        {curves.map((m) => {
          const Icon = m.type === "drink" ? Coffee : Apple;
          return (
            <button key={m.id} onClick={() => { setExpanded(false); onPick?.({ type: m.type as EntryType, label: m.label, carbs_grams: m.carbs }); }}
              className={cn(card, "border-border hover:border-primary/40")}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-status-stable-bg text-status-stable flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <p className="font-medium text-foreground text-sm truncate">{m.label}</p>
              </div>
              <p className="text-xs text-muted-foreground">{when(m.at)}{m.carbs != null ? ` · ~${m.carbs}g ${es ? "carbos" : "carbs"}` : ""}</p>
              <Spark points={m.points} markAt={m.at} tone="meal" big={big} />
              <p className="text-sm text-foreground">
                {m.rise == null
                  ? <span className="text-muted-foreground">{es ? "Sin lecturas para comparar" : "No readings to compare"}</span>
                  : m.rise < 15
                    ? (es ? "Se mantuvo estable" : "Stayed steady")
                    : <>{es ? "Subió" : "Rose"} <strong>~{m.rise}</strong>{m.peakAt ? (es ? `, pico ${Math.round((m.peakAt - m.at) / 60000)} min después` : `, peaked ${Math.round((m.peakAt - m.at) / 60000)} min later`) : ""}</>}
              </p>
            </button>
          );
        })}
    </>);
  };

  return (
    <section className="space-y-2" aria-labelledby="meals-rises-heading">
      <div className="px-1 flex items-start justify-between gap-2">
        <div>
        <h3 id="meals-rises-heading" className="text-base font-semibold text-foreground">
          {es ? "Comidas y subidas de glucosa" : "Recent meals & glucose rises"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {es ? "Cómo cambió tu glucosa después de cada comida." : "How your glucose moved after each meal."}
        </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setExpanded(true)} className="gap-1 shrink-0">
          <Maximize2 className="w-4 h-4" /> {es ? "Ver grande" : "Full view"}
        </Button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">{renderCards(false)}</div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-3xl w-[calc(100vw-1rem)] h-[92dvh] flex flex-col gap-3 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl">{es ? "Comidas y subidas de glucosa" : "Recent meals & glucose rises"}</DialogTitle>
            <DialogDescription>{es ? "Últimos 7 días. La línea punteada marca cuándo comiste." : "Last 7 days. The dotted line marks when you ate."}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto grid gap-3 sm:grid-cols-2 content-start pb-[env(safe-area-inset-bottom)]">{renderCards(true)}</div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
