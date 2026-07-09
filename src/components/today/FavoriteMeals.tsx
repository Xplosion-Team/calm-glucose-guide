import { Star, Apple, Coffee } from "lucide-react";
import { useFavoriteMeals } from "@/hooks/useMealFeatures";
import { useFoodLogs, type FoodLog } from "@/hooks/useFoodLogs";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

interface Props {
  onLogged?: (log: FoodLog) => void;
}

export function FavoriteMeals({ onLogged }: Props) {
  const { lang } = useI18n();
  const { favorites, loading } = useFavoriteMeals();
  const { addLog } = useFoodLogs();

  if (loading) return null;

  return (
    <section className="space-y-2" aria-labelledby="fav-meals-heading">
      <div className="flex items-center gap-2 px-1">
        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
        <h3 id="fav-meals-heading" className="text-base font-semibold text-foreground">
          {lang === "es" ? "Favoritos" : "Favorites"}
        </h3>
      </div>
      {favorites.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1">
          {lang === "es"
            ? "Toca la estrella junto a una comida en el Diario para guardarla aquí."
            : "Tap the star next to a meal in the Journal to save it here."}
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
          {favorites.map((m) => {
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
                  "shrink-0 w-36 snap-start text-left rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-3 hover:border-amber-400 transition-all touch-target",
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                    <Icon className="w-4 h-4 text-status-rising" />
                  </div>
                  <p className="font-medium text-foreground text-sm truncate">{m.label}</p>
                </div>
                {m.avgCarbs != null && (
                  <p className="text-xs text-primary font-medium mt-1">~{m.avgCarbs}g</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
