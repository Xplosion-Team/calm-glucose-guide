import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, ReferenceLine, ReferenceDot,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Clock, Gauge, TrendingUp, Activity, Camera, Type as TypeIcon, Mic, MessageSquare, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { FoodLog } from "@/hooks/useFoodLogs";
import { useMealResponse, scoreBand } from "@/hooks/useMealFeatures";
import { useI18n } from "@/i18n/I18nProvider";

interface Reading { ts: string; mg_dl: number }

interface Props {
  log: FoodLog | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const srcIcon = (s: string) => {
  switch (s) {
    case "photo": return Camera;
    case "text": return TypeIcon;
    case "voice": return Mic;
    case "sms": return MessageSquare;
    default: return Pencil;
  }
};

export function MealDetailSheet({ log, open, onOpenChange }: Props) {
  const { lang } = useI18n();
  const { data: response, loading, recompute } = useMealResponse(log?.id ?? null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [readingsLoading, setReadingsLoading] = useState(false);

  useEffect(() => {
    if (!log || !open) return;
    let cancelled = false;
    (async () => {
      setReadingsLoading(true);
      const meal = new Date(log.logged_at);
      const start = new Date(meal.getTime() - 30 * 60000).toISOString();
      const end = new Date(meal.getTime() + 180 * 60000).toISOString();
      const { data } = await supabase
        .from("cgm_readings").select("ts,mg_dl")
        .gte("ts", start).lte("ts", end).order("ts", { ascending: true });
      if (!cancelled) {
        setReadings(((data ?? []) as Reading[]));
        setReadingsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [log, open]);

  const chartData = useMemo(() => {
    if (!log) return [];
    const mealMs = new Date(log.logged_at).getTime();
    return readings.map((r) => ({
      minutes: Math.round((new Date(r.ts).getTime() - mealMs) / 60000),
      mg_dl: Number(r.mg_dl),
    }));
  }, [readings, log]);

  const band = scoreBand(response?.meal_score ?? null);
  const SrcIcon = log ? srcIcon(log.source) : Pencil;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="text-2xl">{log?.label ?? ""}</SheetTitle>
        </SheetHeader>

        {log && (
          <div className="space-y-4 pt-4 pb-8">
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {new Date(log.logged_at).toLocaleString(lang === "es" ? "es-ES" : "en-US",
                  { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
              <span className="flex items-center gap-1"><SrcIcon className="w-3.5 h-3.5" /> {log.source}</span>
              {log.portion_size && <span className="capitalize">· {log.portion_size}</span>}
              {log.carbs_grams != null && <span className="text-primary font-medium">· ~{log.carbs_grams}g {lang === "es" ? "carbos" : "carbs"}</span>}
            </div>

            {band && response?.status === "ready" && (
              <Card className="glass-card border-0">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{lang === "es" ? "Puntaje de comida" : "Meal Score"}</p>
                    <p className="text-4xl font-semibold text-foreground">{response.meal_score}<span className="text-lg text-muted-foreground">/100</span></p>
                  </div>
                  <Badge className={`${band.className} text-base px-3 py-1.5 border-0`}>
                    <span className="mr-1">{band.emoji}</span> {band.label}
                  </Badge>
                </CardContent>
              </Card>
            )}

            <Card className="glass-card border-0">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  {lang === "es" ? "Respuesta de glucosa" : "Glucose response"}
                </p>
                {readingsLoading ? (
                  <div className="h-48 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : chartData.length < 2 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    {lang === "es"
                      ? "No hay suficientes lecturas de glucosa alrededor de esta comida todavía."
                      : "Not enough glucose readings around this meal yet."}
                  </p>
                ) : (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="minutes" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}m`} />
                        <YAxis tick={{ fontSize: 11 }} domain={["dataMin - 10", "dataMax + 10"]} />
                        <Tooltip formatter={(v: number) => [`${v} mg/dL`, "Glucose"]} labelFormatter={(m) => `${m} min`} />
                        <ReferenceLine y={180} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                        <ReferenceLine y={70} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                        <ReferenceLine x={0} stroke="hsl(var(--primary))" strokeDasharray="4 2" label={{ value: lang === "es" ? "Comida" : "Meal", position: "top", fontSize: 11, fill: "hsl(var(--primary))" }} />
                        <Line type="monotone" dataKey="mg_dl" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                        {response?.peak_mg_dl != null && response.time_to_peak_min != null && (
                          <ReferenceDot x={response.time_to_peak_min} y={Number(response.peak_mg_dl)} r={5} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={2} />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {loading ? (
              <div className="h-24 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : response?.status === "ready" ? (
              <div className="grid grid-cols-2 gap-2">
                <Metric icon={Activity} label={lang === "es" ? "Base" : "Baseline"} value={`${response.baseline_mg_dl} mg/dL`} />
                <Metric icon={TrendingUp} label={lang === "es" ? "Pico" : "Peak"} value={`${response.peak_mg_dl} mg/dL`} />
                <Metric icon={Gauge} label={lang === "es" ? "Aumento" : "Rise"} value={`+${response.glucose_rise}`} />
                <Metric icon={Clock} label={lang === "es" ? "Recuperación" : "Recovery"} value={response.recovery_time_min != null ? `${response.recovery_time_min} min` : "—"} />
              </div>
            ) : (
              <Card className="glass-card border-0">
                <CardContent className="p-4 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {lang === "es"
                      ? "El análisis se ejecutará cuando haya lecturas de glucosa disponibles."
                      : "Analysis will run once glucose readings are available."}
                  </p>
                  <button onClick={recompute} className="text-primary text-sm underline">
                    {lang === "es" ? "Volver a analizar" : "Re-analyze"}
                  </button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <Card className="glass-card border-0">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><Icon className="w-3.5 h-3.5" /> {label}</div>
        <p className="text-base font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
