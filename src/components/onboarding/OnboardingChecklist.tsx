import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
}

interface OnboardingChecklistProps {
  items: ChecklistItem[];
  onStartTour: () => void;
  onResetChecklist: () => void;
}

export function OnboardingChecklist({ items, onStartTour, onResetChecklist }: OnboardingChecklistProps) {
  const [expanded, setExpanded] = useState(true);

  const completed = items.filter((i) => i.completed).length;
  const total = items.length;
  const allDone = completed === total;
  const progressPercent = Math.round((completed / total) * 100);

  return (
    <div className="fixed bottom-20 right-4 z-40 w-80 rounded-2xl border bg-card shadow-lg overflow-hidden animate-fade-in">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground text-sm">
            Getting Started
          </span>
          <span className="text-xs text-muted-foreground">
            {completed}/{total}
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-1">
        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-start gap-3 p-2.5 rounded-xl transition-colors",
                item.completed ? "bg-secondary/40" : "bg-background"
              )}
            >
              {item.completed ? (
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
              )}
              <div>
                <p
                  className={cn(
                    "text-sm font-medium",
                    item.completed ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onStartTour}
              className="flex-1 gap-1.5 text-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {allDone ? "Replay Tour" : "Start Tour"}
            </Button>
            {allDone && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetChecklist}
                className="gap-1.5 text-xs text-muted-foreground"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
            )}
          </div>

          {allDone && (
            <p className="text-center text-xs text-primary font-medium pt-1">
              🎉 You&apos;re all set! Enjoy Calm Glucose Guide.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
