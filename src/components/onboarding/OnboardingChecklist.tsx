import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Sparkles, RotateCcw, X, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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
  onDismiss?: () => void;
  onHideForever?: () => void;
}

export function OnboardingChecklist({
  items,
  onStartTour,
  onResetChecklist,
  onDismiss,
  onHideForever,
}: OnboardingChecklistProps) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(!isMobile);

  const completed = items.filter((i) => i.completed).length;
  const total = items.length;
  const allDone = completed === total;
  const progressPercent = Math.round((completed / total) * 100);

  return (
    <div
      className={cn(
        "fixed z-40 rounded-2xl border bg-card shadow-lg overflow-hidden animate-fade-in",
        isMobile
          ? "bottom-16 left-2 right-2 w-auto max-h-[70vh] overflow-y-auto"
          : "bottom-20 right-4 w-80",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 hover:bg-secondary/30 transition-colors">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <span className="font-semibold text-foreground text-xs sm:text-sm">
            Getting Started
          </span>
          <span className="text-xs text-muted-foreground">
            {completed}/{total}
          </span>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground ml-1" />
          )}
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Close Getting Started"
            className="ml-2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors touch-target"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-3 sm:px-4 pb-1">
        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-start gap-2.5 p-2 sm:p-2.5 rounded-xl transition-colors",
                item.completed ? "bg-secondary/40" : "bg-background",
              )}
            >
              {item.completed ? (
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-xs sm:text-sm font-medium",
                    item.completed ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {item.label}
                </p>
                {!isMobile && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Actions */}
          <div className="flex gap-2 pt-1 sm:pt-2">
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

          {onHideForever && (
            <button
              onClick={onHideForever}
              className="w-full flex items-center justify-center gap-1.5 pt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Don&apos;t show this again
            </button>
          )}

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
