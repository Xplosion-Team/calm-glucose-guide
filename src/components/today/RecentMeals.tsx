import { Apple, Coffee, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useRecentMeals } from "@/hooks/useMealFeatures";
import { useFoodLogs, type FoodLog } from "@/hooks/useFoodLogs";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

interface Props {
  onLogged?: (log: FoodLog) => void;
}

export function RecentMeals({ onLogged }: Props) {
  const { t, lang } = useI18n();
  const { meals, loading } = useRecentMeals(10);
  const { addLog } = useFoodLogs();

  if (loading || meals.length === 0) return null;

  const relative = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (days === 0) return lang === "es" ? "Hoy" : "Today";
    if (days === 1) return lang === "es" ? "Ayer" : "Yesterday";
    if (days < 7) return lang === "es" ? `Hace ${days} días` : `${days}d ago`;
    return d.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", { month: "short", day: "numeric" });
  };

  return (
    <section className="space-y-2" aria-labelledby="recent-meals-heading">
      <h3 id="recent-meals-heading" className="text-base font-semibold text-foreground px-1">
        {lang === "es" ? "Comidas recientes" : "Recent Meals"}
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {meals.map((m) => {
          const Icon = m.type === "drink" ? Coffee : Apple;
          return (
            <button
              key={`${m.type}-${m.label}`}
              onClick={async () => {
                const saved = await addLog({
                  type: m.type,
                  label: m.label,
                  carbsGrams: m.avgCarbs ?? undefined,
                  source: "manual",
                });
                if (saved) onLogged?.(saved);
              }}
              className={cn(
                "shrink-0 w-40 snap-start text-left rounded-2xl border-2 border-border bg-card p-3 hover:border-primary/40 transition-all touch-target",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-status-rising-bg text-status-rising flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <p className="font-medium text-foreground text-sm truncate">{m.label}</p>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> {relative(m.lastLoggedAt)}
              </div>
              {m.avgCarbs != null && (
                <p className="text-xs text-primary font-medium mt-1">~{m.avgCarbs}g {lang === "es" ? "carbos" : "carbs"}</p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
