import { useState, useMemo } from "react";
import { Apple, Coffee, Pill, Plus, Check, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useScreenContext } from "@/hooks/useScreenContext";
import { cn } from "@/lib/utils";

type EntryType = "food" | "drink" | "med";

interface LogEntry {
  id: string;
  type: EntryType;
  label: string;
  time: string;
}

const QUICK_OPTIONS: { type: EntryType; label: string; icon: typeof Apple }[] = [
  { type: "food", label: "Food", icon: Apple },
  { type: "drink", label: "Drink", icon: Coffee },
  { type: "med", label: "Medication", icon: Pill },
];

const PRESETS: Record<EntryType, string[]> = {
  food: ["Breakfast", "Lunch", "Dinner", "Snack", "Fruit", "Salad"],
  drink: ["Water", "Coffee", "Tea", "Juice", "Milk"],
  med: ["Morning meds", "Evening meds", "Insulin", "Vitamins"],
};

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function TodayTab() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [activeType, setActiveType] = useState<EntryType | null>(null);
  const [customText, setCustomText] = useState("");

  useScreenContext(
    useMemo(
      () => ({
        screen: "Today",
        status: `You've logged ${entries.length} item${entries.length !== 1 ? "s" : ""} today.`,
        highlights: [
          "Tap Food, Drink, or Medication to quickly log what you've had.",
          "You can pick a common option or type your own.",
        ],
        data: { entryCount: entries.length },
        fallback: `You're on the Today screen. Log your food, drinks, and medications here.`,
      }),
      [entries.length],
    ),
  );

  const addEntry = (type: EntryType, label: string) => {
    setEntries((prev) => [
      { id: crypto.randomUUID(), type, label, time: timeNow() },
      ...prev,
    ]);
    setActiveType(null);
    setCustomText("");
  };

  const handleCustomSubmit = () => {
    if (activeType && customText.trim()) {
      addEntry(activeType, customText.trim());
    }
  };

  const iconFor = (type: EntryType) => {
    switch (type) {
      case "food": return Apple;
      case "drink": return Coffee;
      case "med": return Pill;
    }
  };

  const colorFor = (type: EntryType) => {
    switch (type) {
      case "food": return "text-status-rising bg-status-rising-bg";
      case "drink": return "text-primary bg-primary/10";
      case "med": return "text-status-stable bg-status-stable-bg";
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      {/* Hero */}
      <div className="text-center py-3">
        <h2 className="text-2xl font-semibold text-foreground mb-1">Today</h2>
        <p className="text-lg text-muted-foreground">
          What have you had so far?
        </p>
      </div>

      {/* Quick-add buttons */}
      <div className="grid grid-cols-3 gap-3">
        {QUICK_OPTIONS.map(({ type, label, icon: Icon }) => {
          const isActive = activeType === type;
          return (
            <button
              key={type}
              onClick={() => setActiveType(isActive ? null : type)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all touch-target",
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", colorFor(type))}>
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium text-foreground">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Presets + custom input */}
      {activeType && (
        <Card className="glass-card border-0 animate-fade-in">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              Quick picks
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS[activeType].map((preset) => (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-base px-4 py-2 h-auto"
                  onClick={() => addEntry(activeType, preset)}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  {preset}
                </Button>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Or type your own…"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                className="text-base h-12 rounded-xl"
              />
              <Button
                size="icon"
                className="h-12 w-12 rounded-xl shrink-0"
                disabled={!customText.trim()}
                onClick={handleCustomSubmit}
              >
                <Check className="w-5 h-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's log */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground px-1">
            Today's log
          </h3>
          {entries.map((entry) => {
            const Icon = iconFor(entry.type);
            return (
              <Card key={entry.id} className="glass-card border-0">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", colorFor(entry.type))}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{entry.label}</p>
                    <p className="text-sm text-muted-foreground capitalize">{entry.type}</p>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    {entry.time}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {entries.length === 0 && !activeType && (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-lg">
            Tap a button above to start logging
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Keeping track helps you and your care team see patterns
          </p>
        </div>
      )}
    </div>
  );
}
