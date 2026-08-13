import { Bell, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { MealReminder } from "@/hooks/useMealReminders";

interface Props {
  reminder: MealReminder;
  onCheckIn: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
}

/**
 * In-app post-meal check-in. Appears once the reminder for a logged meal
 * comes due (default: two hours after the meal).
 */
export function MealReminderBanner({ reminder, onCheckIn, onSnooze, onDismiss }: Props) {
  return (
    <Card className="border-primary/30 bg-primary/5 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">
              How did your {reminder.meal_label} settle?
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              It's been a couple of hours. A quick note now helps us learn your rhythm.
            </p>
          </div>
          <button
            aria-label="Dismiss reminder"
            onClick={onDismiss}
            className="p-1 text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="min-h-[44px]" onClick={onCheckIn}>
            Add a note
          </Button>
          <Button size="sm" variant="outline" className="min-h-[44px]" onClick={onSnooze}>
            Remind me later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
