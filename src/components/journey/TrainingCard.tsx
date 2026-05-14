import { useEffect, useState } from "react";
import { Apple, Pill, GraduationCap, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useFoodLogs } from "@/hooks/useFoodLogs";
import { useI18n } from "@/i18n/I18nProvider";
import { PortionGuide } from "@/components/today/PortionGuide";
import { cn } from "@/lib/utils";

type Tier = "A" | "B" | "C";

interface Engagement {
  trial_tier: Tier;
  trial_start: string;
  total_meals_logged: number;
}

const TIER_GOAL: Record<Tier, { meals: number; key: string }> = {
  A: { meals: 30, key: "training.goalA" },
  B: { meals: 15, key: "training.goalB" },
  C: { meals: 10, key: "training.goalC" },
};

export function TrainingCard() {
  const { t } = useI18n();
  const { logs } = useFoodLogs();
  const [eng, setEng] = useState<Engagement | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("user_engagement")
        .select("trial_tier,trial_start,total_meals_logged")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data) setEng(data as Engagement);
    })();
  }, [logs.length]);

  const tier: Tier = eng?.trial_tier ?? "C";
  const goal = TIER_GOAL[tier];

  const meals = logs.filter((l) => l.type === "food" || l.type === "drink").length;
  const meds = logs.filter((l) => l.type === "med").length;

  const mealsPct = Math.min(100, Math.round((meals / goal.meals) * 100));
  const medsPct = meds > 0 ? 100 : 0;

  const checks = [
    { id: "first", labelKey: "training.firstMeal", done: meals >= 1 },
    { id: "photo", labelKey: "training.tryPhoto", done: logs.some((l) => l.source === "photo") },
    { id: "voice", labelKey: "training.tryVoice", done: logs.some((l) => l.source === "voice") },
    { id: "text", labelKey: "training.tryText", done: logs.some((l) => l.source === "text") },
    { id: "med", labelKey: "training.logMed", done: meds >= 1 },
  ] as const;

  return (
    <Card className="glass-card border-2 border-primary/20">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">{t("training.title")}</h3>
          <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {t("training.tier")} {tier}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{t(goal.key as any)}</p>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium flex items-center gap-1.5"><Apple className="w-4 h-4 text-status-rising" /> {t("training.nutrition")}</span>
              <span className="text-sm text-muted-foreground">{meals} / {goal.meals}</span>
            </div>
            <Progress value={mealsPct} className="h-2" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium flex items-center gap-1.5"><Pill className="w-4 h-4 text-status-stable" /> {t("training.meds")}</span>
              <span className="text-sm text-muted-foreground">{meds > 0 ? t("training.started") : t("training.notYet")}</span>
            </div>
            <Progress value={medsPct} className="h-2" />
          </div>
        </div>

        <ul className="space-y-1.5 pt-1">
          {checks.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                  c.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {c.done && <Check className="w-3 h-3" />}
              </span>
              <span className={cn(c.done ? "text-foreground line-through opacity-70" : "text-foreground")}>
                {t(c.labelKey as any)}
              </span>
            </li>
          ))}
        </ul>

        <div className="pt-2">
          <PortionGuide />
        </div>
      </CardContent>
    </Card>
  );
}
