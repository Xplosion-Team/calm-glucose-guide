import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Apple, Coffee, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nProvider";
import { mealCurve, unmatchedRises, type MealIn, type Reading } from "@/lib/meal-glucose";
import { cn } from "@/lib/utils";

const DAY = 864e5;
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** One day at a glance: glucose line across 24 hours with meal and rise markers. */
export function DailyTimeline() {
  const { lang } = useI18n();
  const es = lang === "es";
  const loc = es ? "es-ES" : "en-US";
  const today = startOfDay(new Date());
  const [day, setDay] = useState(today);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [meals, setMeals] = useState<MealIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const t0 = day.getTime();
  const t1 = t0 + DAY;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSelected(null);
    (async () => {
      // Include 3 h on each side so meals near midnight still get their curve.
      const from = new Date(t0 - 3 * 3.6e6).toISOString();
      const to = new Date(t1 + 3 * 3.6e6).toISOString();
      const [{ data: cgm }, { data: logs }] = await Promise.all([
        supabase.from("cgm_readings").select("ts,mg_dl").gte("ts", from).lt("ts", to).order("ts").limit(1000),
        supabase.from("food_logs").select("id,label,type,carbs_grams,logged_at").in("type", ["food", "drink"])
          .gte("logged_at", from).lt("logged_at", to).order("logged_at"),
      ]);
      if (!alive) return;
      setReadings((cgm ?? []).map((c) => ({ t: Date.parse(c.ts), v: Number(c.mg_dl) })));
      setMeals((logs ?? []).map((l) => ({ id: l.id, label: l.label, type: l.type, carbs: l.carbs_grams, at: Date.parse(l.logged_at) })));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [t0, t1]);

  const dayReadings = useMemo(() => readings.filter((r) => r.t >= t0 && r.t < t1), [readings, t0, t1]);
  const dayMeals = useMemo(() => meals.filter((m) => m.at >= t0 && m.at < t1).map((m) => mealCurve(m, readings)), [meals, readings, t0, t1]);
  const rises = useMemo(() => unmatchedRises(readings, meals).filter((r) => r.start >= t0 && r.start < t1), [readings, meals, t0, t1]);

  // Chart geometry (viewBox units)
  const W = 1000, H = 260, PAD_T = 30, PAD_B = 30;
  const vals = dayReadings.map((r) => r.v);
  const lo = Math.min(70, ...vals) - 10, hi = Math.max(200, ...vals) + 10;
  const x = (t: number) => ((t - t0) / DAY) * W;
  const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);
  // Break the line where the sensor had a gap of more than 20 minutes.
  const path = dayReadings.map((r, i) => {
    const gap = i === 0 || r.t - dayReadings[i - 1].t > 20 * 60000;
    return `${gap ? "M" : "L"}${x(r.t).toFixed(1)},${y(r.v).toFixed(1)}`;
  }).join(" ");
  const valueAt = (t: number) => {
    const near = dayReadings.reduce<Reading | null>((a, b) => (!a || Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a), null);
    return near && Math.abs(near.t - t) < 30 * 60000 ? near.v : null;
  };

  const days = Array.from({ length: 14 }, (_, i) => new Date(today.getTime() - (13 - i) * DAY));
  const time = (t: number) => new Date(t).toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" });
  const dayTitle = day.getTime() === today.getTime() ? (es ? "Hoy" : "Today")
    : day.getTime() === today.getTime() - DAY ? (es ? "Ayer" : "Yesterday")
    : day.toLocaleDateString(loc, { weekday: "long", month: "long", day: "numeric" });

  const sel = selected?.startsWith("m:") ? dayMeals.find((m) => `m:${m.id}` === selected)
    : null;
  const selRise = selected?.startsWith("r:") ? rises.find((r) => `r:${r.start}` === selected) : null;

  return (
    <section className="space-y-3 rounded-3xl border-2 border-border bg-card p-4" aria-labelledby="daily-timeline-heading">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 id="daily-timeline-heading" className="text-base font-semibold text-foreground">
            {es ? "Tu día" : "Daily timeline"}
          </h3>
          <p className="text-sm text-muted-foreground">{dayTitle}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-12 w-12" aria-label={es ? "Día anterior" : "Previous day"}
            disabled={day.getTime() <= days[0].getTime()} onClick={() => setDay(new Date(t0 - DAY))}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12" aria-label={es ? "Día siguiente" : "Next day"}
            disabled={day.getTime() >= today.getTime()} onClick={() => setDay(new Date(t0 + DAY))}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label={es ? "Elegir día" : "Choose a day"}>
        {days.map((d) => {
          const active = d.getTime() === t0;
          return (
            <button key={d.getTime()} role="tab" aria-selected={active} onClick={() => setDay(d)}
              className={cn("shrink-0 w-14 rounded-2xl border-2 py-2 text-center transition-colors touch-target",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary/40")}>
              <span className="block text-xs">{d.toLocaleDateString(loc, { weekday: "short" })}</span>
              <span className="block text-lg font-semibold leading-tight">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        {loading ? (
          <div className="h-56 rounded-2xl bg-muted/50 animate-pulse" />
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56 sm:h-64" role="img"
            aria-label={es ? "Glucosa del día con comidas" : "Glucose for the day with meals"}>
            {[0, 6, 12, 18, 24].map((h) => (
              <g key={h}>
                <line x1={x(t0 + h * 3.6e6)} x2={x(t0 + h * 3.6e6)} y1={PAD_T} y2={H - PAD_B} className="stroke-border" strokeWidth="1" />
                <text x={Math.min(W - 30, Math.max(4, x(t0 + h * 3.6e6) - 18))} y={H - 8} className="fill-muted-foreground" fontSize="20">
                  {h === 24 ? "" : new Date(t0 + h * 3.6e6).toLocaleTimeString(loc, { hour: "numeric" })}
                </text>
              </g>
            ))}
            {path && <path d={path} fill="none" className="stroke-primary" strokeWidth="3" strokeLinejoin="round" />}

            {rises.map((r) => (
              <g key={`r${r.start}`} onClick={() => setSelected(`r:${r.start}`)} className="cursor-pointer">
                <line x1={x(r.start)} x2={x(r.start)} y1={PAD_T} y2={H - PAD_B} className="stroke-status-rising" strokeDasharray="6 6" strokeWidth="2" />
                <circle cx={x(r.peakAt)} cy={y(r.peak)} r="9" className="fill-status-rising" />
                <circle cx={x(r.start)} cy={14} r="14" className="fill-status-rising-bg stroke-status-rising" strokeWidth="2" />
                <text x={x(r.start)} y={20} textAnchor="middle" fontSize="18" className="fill-status-rising font-bold">?</text>
              </g>
            ))}

            {dayMeals.map((m) => {
              const v = valueAt(m.at);
              return (
                <g key={m.id} onClick={() => setSelected(`m:${m.id}`)} className="cursor-pointer">
                  <line x1={x(m.at)} x2={x(m.at)} y1={PAD_T} y2={H - PAD_B} className="stroke-status-stable" strokeWidth="2" />
                  {v != null && <circle cx={x(m.at)} cy={y(v)} r="8" className="fill-card stroke-status-stable" strokeWidth="3" />}
                  <circle cx={x(m.at)} cy={14} r="14" className={cn("stroke-status-stable", selected === `m:${m.id}` ? "fill-status-stable" : "fill-status-stable-bg")} strokeWidth="2" />
                </g>
              );
            })}
          </svg>
        )}
        {!loading && !dayReadings.length && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            {es ? "No hay lecturas del sensor este día" : "No sensor readings for this day"}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-status-stable" /> {es ? "Comida anotada" : "Meal logged"}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-status-rising" /> {es ? "Subida sin comida" : "Rise with no meal"}</span>
      </div>

      {(sel || selRise) && (
        <div className={cn("rounded-2xl p-3 text-sm", sel ? "bg-status-stable-bg" : "bg-status-rising-bg")}>
          {sel ? (
            <p><strong>{sel.label}</strong> · {time(sel.at)}{sel.carbs != null ? ` · ~${sel.carbs}g carbs` : ""}<br />
              {sel.rise == null ? (es ? "Sin lecturas para comparar" : "No readings to compare")
                : sel.rise < 15 ? (es ? "Se mantuvo estable" : "Stayed steady")
                : `${es ? "Subió" : "Rose"} ~${sel.rise}${sel.peakAt ? (es ? `, pico a las ${time(sel.peakAt)}` : `, peaked at ${time(sel.peakAt)}`) : ""}`}
            </p>
          ) : selRise && (
            <p><strong>{es ? "¿Comiste algo?" : "Did you eat something?"}</strong><br />
              {es ? "Empezó a subir a las" : "Started rising at"} {time(selRise.start)}, {es ? "subió" : "rose"} ~{Math.round(selRise.peak - selRise.startValue)}.</p>
          )}
        </div>
      )}

      <ul className="divide-y divide-border">
        {[...dayMeals.map((m) => ({ k: `m:${m.id}`, t: m.at, meal: m })), ...rises.map((r) => ({ k: `r:${r.start}`, t: r.start, rise: r }))]
          .sort((a, b) => a.t - b.t)
          .map((row) => {
            const Icon = "meal" in row && row.meal ? (row.meal.type === "drink" ? Coffee : Apple) : TrendingUp;
            return (
              <li key={row.k}>
                <button onClick={() => setSelected(row.k)} className={cn("w-full flex items-center gap-3 py-3 text-left touch-target", selected === row.k && "font-semibold")}>
                  <span className="w-16 shrink-0 text-sm text-muted-foreground">{time(row.t)}</span>
                  <Icon className={cn("w-5 h-5 shrink-0", "meal" in row && row.meal ? "text-status-stable" : "text-status-rising")} />
                  <span className="flex-1 truncate text-foreground">
                    {"meal" in row && row.meal ? row.meal.label : (es ? "Subida sin comida anotada" : "Rise with no meal logged")}
                  </span>
                  <span className="text-sm text-muted-foreground shrink-0">
                    {"meal" in row && row.meal ? (row.meal.rise != null ? `+${row.meal.rise}` : "—")
                      : "rise" in row && row.rise ? `+${Math.round(row.rise.peak - row.rise.startValue)}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
