import { TrendingUp, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PendingSpike } from "@/hooks/useSpikeDetection";
import { useNotificationPrefs } from "@/hooks/useNotificationPrefs";
import { formatInAppNudge } from "@/lib/nudge-persona";

interface Props {
  spike: PendingSpike;
  onLogMeal: () => void;
  onLogDrink: () => void;
  onNotFood: () => void;
  onDismiss: () => void;
}

/**
 * In-app spike reminder. Rendered above the active tab whenever the detector
 * finds an unexplained rapid rise. Actions are wired to the existing
 * SmartLogCard workflow — no new logging UI is introduced.
 */
export function SpikeBanner({ spike, onLogMeal, onLogDrink, onNotFood, onDismiss }: Props) {
  const { prefs } = useNotificationPrefs();
  const message = formatInAppNudge("spike", prefs);
  return (
    <Card className="border-amber-200 bg-amber-50/70 dark:bg-amber-950/30 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">
              {message.title}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {message.body}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="text-muted-foreground shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" onClick={onLogMeal} className="touch-target">Log meal</Button>
          <Button size="sm" variant="outline" onClick={onLogDrink} className="touch-target">Log drink</Button>
          <Button size="sm" variant="ghost" onClick={onNotFood} className="touch-target">Not food</Button>
        </div>
      </CardContent>
    </Card>
  );
}
