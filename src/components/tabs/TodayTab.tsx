import { useState, useMemo } from "react";
import { Apple, Coffee, Pill, Plus, Check, Clock, BookOpen, ArrowLeft, Camera, Type as TypeIcon, Mic, MessageSquare, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useScreenContext } from "@/hooks/useScreenContext";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { useFoodLogs, type EntryType, type Source } from "@/hooks/useFoodLogs";
import { SmartLogCard } from "@/components/today/SmartLogCard";
import { JournalView } from "@/components/journal/JournalView";
import type { TranslationKey } from "@/i18n/translations";

const QUICK_OPTIONS: { type: EntryType; labelKey: TranslationKey; icon: typeof Apple }[] = [
  { type: "food", labelKey: "today.food", icon: Apple },
  { type: "drink", labelKey: "today.drink", icon: Coffee },
  { type: "med", labelKey: "today.medication", icon: Pill },
];

const PRESETS: Record<EntryType, TranslationKey[]> = {
  food: ["preset.breakfast", "preset.lunch", "preset.dinner", "preset.snack", "preset.fruit", "preset.salad"],
  drink: ["preset.water", "preset.coffee", "preset.tea", "preset.juice", "preset.milk"],
  med: ["preset.morningMeds", "preset.eveningMeds", "preset.insulin", "preset.vitamins"],
};

const PORTION_KEYS: Record<string, TranslationKey> = {
  small: "today.portionSmall",
  medium: "today.portionMedium",
  large: "today.portionLarge",
};

const colorFor = (type: EntryType) => {
  switch (type) {
    case "food": return "text-status-rising bg-status-rising-bg";
    case "drink": return "text-primary bg-primary/10";
    case "med": return "text-status-stable bg-status-stable-bg";
  }
};

const iconFor = (type: EntryType) => {
  switch (type) {
    case "food": return Apple;
    case "drink": return Coffee;
    case "med": return Pill;
  }
};

const sourceIcon = (s: Source) => {
  switch (s) {
    case "photo": return Camera;
    case "text": return TypeIcon;
    case "voice": return Mic;
    case "sms": return MessageSquare;
    default: return Pencil;
  }
};

export function TodayTab() {
  const { t, lang } = useI18n();
  const { logs, addLog } = useFoodLogs();
  const [activeType, setActiveType] = useState<EntryType | null>(null);
  const [customText, setCustomText] = useState("");
  const [showJournal, setShowJournal] = useState(false);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayLogs = useMemo(
    () => logs.filter((l) => l.logged_at.slice(0, 10) === todayKey),
    [logs, todayKey],
  );

  useScreenContext(
    useMemo(
      () => ({
        screen: "Today",
        status: `You've logged ${todayLogs.length} item${todayLogs.length !== 1 ? "s" : ""} today.`,
        highlights: [
          "Use Smart Log to snap a photo, type, or speak what you ate.",
          "Quick buttons let you log food, drinks, and medications fast.",
          "Tap View past days to review your journal.",
        ],
        data: { entryCount: todayLogs.length },
        fallback: "You're on the Today screen. Log your food, drinks, and medications here.",
      }),
      [todayLogs.length],
    ),
  );

  if (showJournal) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setShowJournal(false)} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> {t("today.backToToday")}
        </Button>
        <JournalView />
      </div>
    );
  }

  const quickAdd = (type: EntryType, label: string) => {
    addLog({ type, label, source: "manual" });
    setActiveType(null);
    setCustomText("");
  };

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      <div className="text-center py-3">
        <h2 className="text-2xl font-semibold text-foreground mb-1">{t("today.title")}</h2>
        <p className="text-lg text-muted-foreground">{t("today.subtitle")}</p>
      </div>

      <SmartLogCard
        onConfirm={(r) => {
          addLog({
            type: r.type,
            label: r.label,
            carbsGrams: r.carbsGrams,
            portionSize: r.portionSize,
            source: r.source,
          });
        }}
      />

      {/* Quick option buttons */}
      <div className="grid grid-cols-3 gap-2">
        {QUICK_OPTIONS.map(({ type, labelKey, icon: Icon }) => {
          const isActive = activeType === type;
          return (
            <button
              key={type}
              onClick={() => setActiveType(isActive ? null : type)}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all touch-target",
                isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/40"
              )}
            >
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", colorFor(type))}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-foreground">{t(labelKey)}</span>
            </button>
          );
        })}
      </div>

      {activeType && (
        <Card className="glass-card border-0 animate-fade-in">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">{t("today.quickPicks")}</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS[activeType].map((presetKey) => (
                <Button
                  key={presetKey}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-base px-4 py-2 h-auto"
                  onClick={() => quickAdd(activeType, t(presetKey))}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  {t(presetKey)}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Input
                placeholder={t("today.typeOwn")}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && customText.trim() && quickAdd(activeType, customText.trim())}
                className="text-base h-12 rounded-xl"
              />
              <Button
                size="icon"
                className="h-12 w-12 rounded-xl shrink-0"
                disabled={!customText.trim()}
                onClick={() => quickAdd(activeType, customText.trim())}
              >
                <Check className="w-5 h-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's log */}
      {todayLogs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base font-semibold text-foreground">{t("today.log")}</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowJournal(true)} className="gap-1 text-primary">
              <BookOpen className="w-4 h-4" /> {t("today.viewJournal")}
            </Button>
          </div>
          {todayLogs.map((entry) => {
            const Icon = iconFor(entry.type);
            const SrcIcon = sourceIcon(entry.source);
            return (
              <Card key={entry.id} className="glass-card border-0">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", colorFor(entry.type))}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{entry.label}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <SrcIcon className="w-3.5 h-3.5" />
                      <span className="capitalize">{t(`today.${entry.type}` as TranslationKey)}</span>
                      {entry.carbs_grams != null && <span className="text-primary font-medium">~{entry.carbs_grams}g</span>}
                      {entry.portion_size && <span>{t(PORTION_KEYS[entry.portion_size])}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(entry.logged_at).toLocaleTimeString(lang === "es" ? "es-ES" : "en-US", { hour: "numeric", minute: "2-digit" })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {todayLogs.length === 0 && !activeType && (
        <div className="text-center py-6">
          <p className="text-muted-foreground text-lg">{t("today.startLogging")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("today.trackingHelps")}</p>
          <Button variant="ghost" size="sm" onClick={() => setShowJournal(true)} className="mt-3 gap-1 text-primary">
            <BookOpen className="w-4 h-4" /> {t("today.viewJournal")}
          </Button>
        </div>
      )}
    </div>
  );
}
