import { useState, useMemo, useRef } from "react";
import { Apple, Coffee, Pill, Plus, Check, Clock, Camera, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useScreenContext } from "@/hooks/useScreenContext";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { TranslationKey } from "@/i18n/translations";

type EntryType = "food" | "drink" | "med";

interface LogEntry {
  id: string;
  type: EntryType;
  label: string;
  time: string;
  carbsGrams?: number;
  portionSize?: "small" | "medium" | "large";
}

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

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

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

const PORTION_KEYS: Record<string, TranslationKey> = {
  small: "today.portionSmall",
  medium: "today.portionMedium",
  large: "today.portionLarge",
};

/** Compress image to ~1MB max via canvas resize */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1024;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        // Strip the data:image/jpeg;base64, prefix
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface AIFoodResult {
  foodName: string;
  carbsGrams: number;
  portionSize: "small" | "medium" | "large";
  category: "meal" | "snack" | "drink";
}

export function TodayTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [activeType, setActiveType] = useState<EntryType | null>(null);
  const [customText, setCustomText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIFoodResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useScreenContext(
    useMemo(
      () => ({
        screen: "Today",
        status: `You've logged ${entries.length} item${entries.length !== 1 ? "s" : ""} today.`,
        highlights: [
          "Tap Food, Drink, or Medication to quickly log what you've had.",
          "You can pick a common option or type your own.",
          "Use the camera button to snap a photo and auto-identify food with carb estimates.",
        ],
        data: { entryCount: entries.length },
        fallback: `You're on the Today screen. Log your food, drinks, and medications here.`,
      }),
      [entries.length],
    ),
  );

  const addEntry = (type: EntryType, label: string, carbsGrams?: number, portionSize?: "small" | "medium" | "large") => {
    setEntries((prev) => [
      { id: crypto.randomUUID(), type, label, time: timeNow(), carbsGrams, portionSize },
      ...prev,
    ]);
    setActiveType(null);
    setCustomText("");
    setAiResult(null);
  };

  const handleCustomSubmit = () => {
    if (activeType && customText.trim()) {
      addEntry(activeType, customText.trim());
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";

    setAnalyzing(true);
    setAiResult(null);
    setActiveType("food");

    try {
      const imageBase64 = await compressImage(file);
      const { data, error } = await supabase.functions.invoke("analyze-food", {
        body: { imageBase64, lang },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result = data as AIFoodResult;
      setAiResult(result);
      setCustomText(result.foodName);

      // Auto-set type based on AI category
      if (result.category === "drink") {
        setActiveType("drink");
      } else {
        setActiveType("food");
      }
    } catch (err) {
      console.error("Photo analysis failed:", err);
      toast({
        title: t("today.photoError"),
        variant: "destructive",
      });
      // Fall back to manual text input for food
      setActiveType("food");
    } finally {
      setAnalyzing(false);
    }
  };

  const confirmAiResult = () => {
    if (aiResult && activeType) {
      addEntry(activeType, customText.trim() || aiResult.foodName, aiResult.carbsGrams, aiResult.portionSize);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      <div className="text-center py-3">
        <h2 className="text-2xl font-semibold text-foreground mb-1">{t("today.title")}</h2>
        <p className="text-lg text-muted-foreground">{t("today.subtitle")}</p>
      </div>

      {/* Quick option buttons + camera */}
      <div className="grid grid-cols-4 gap-2">
        {QUICK_OPTIONS.map(({ type, labelKey, icon: Icon }) => {
          const isActive = activeType === type;
          return (
            <button
              key={type}
              onClick={() => { setActiveType(isActive ? null : type); setAiResult(null); }}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all touch-target",
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", colorFor(type))}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-foreground">{t(labelKey)}</span>
            </button>
          );
        })}

        {/* Camera button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={analyzing}
          className={cn(
            "flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all touch-target",
            "border-border bg-card hover:border-primary/40",
            analyzing && "opacity-60"
          )}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-100 text-amber-600">
            {analyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
          </div>
          <span className="text-xs font-medium text-foreground">{t("today.camera")}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoCapture}
        />
      </div>

      {/* Analyzing indicator */}
      {analyzing && (
        <Card className="glass-card border-0 animate-fade-in">
          <CardContent className="p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-base text-muted-foreground">{t("today.analyzing")}</p>
          </CardContent>
        </Card>
      )}

      {/* AI result review card */}
      {aiResult && !analyzing && (
        <Card className="glass-card border-2 border-primary/30 animate-fade-in">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-muted-foreground">AI identified</p>
            </div>

            <Input
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="text-base h-12 rounded-xl"
            />

            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                ~{aiResult.carbsGrams}g carbs
              </span>
              <span className="bg-muted px-2 py-1 rounded-full">
                {t(PORTION_KEYS[aiResult.portionSize])}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">{t("today.carbsDisclaimer")}</p>

            <Button
              className="w-full h-12 rounded-xl text-base"
              onClick={confirmAiResult}
              disabled={!customText.trim()}
            >
              <Check className="w-5 h-5 mr-2" />
              {t("today.food")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Preset panel (hidden when AI result is showing) */}
      {activeType && !aiResult && !analyzing && (
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
                  onClick={() => addEntry(activeType, t(presetKey))}
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

      {/* Log entries */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground px-1">{t("today.log")}</h3>
          {entries.map((entry) => {
            const Icon = iconFor(entry.type);
            return (
              <Card key={entry.id} className="glass-card border-0">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", colorFor(entry.type))}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{entry.label}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="capitalize">{t(`today.${entry.type}` as TranslationKey)}</span>
                      {entry.carbsGrams != null && (
                        <span className="text-primary font-medium">~{entry.carbsGrams}g</span>
                      )}
                      {entry.portionSize && (
                        <span>{t(PORTION_KEYS[entry.portionSize])}</span>
                      )}
                    </div>
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

      {entries.length === 0 && !activeType && !analyzing && (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-lg">{t("today.startLogging")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("today.trackingHelps")}</p>
        </div>
      )}
    </div>
  );
}
