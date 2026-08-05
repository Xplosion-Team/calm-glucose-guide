import { useEffect, useState } from "react";
import { Apple, Coffee, Pill, Sparkles, Loader2, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { FoodLog, PortionSize, EntryType } from "@/hooks/useFoodLogs";

interface EditPatch {
  type: EntryType;
  label: string;
  carbsGrams: number | null;
  portionSize: PortionSize | null;
  loggedAt: string;
  notes: string | null;
  proteinG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
  sugarG?: number | null;
  calories?: number | null;
}

/** A saved log (has an id) or a draft entry not yet written to the database. */
export interface EditableLog {
  id?: string;
  type: EntryType;
  label: string;
  carbs_grams?: number | null;
  portion_size?: PortionSize | null;
  logged_at?: string;
  notes?: string | null;
}

interface Props {
  log: EditableLog | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (id: string | undefined, patch: EditPatch) => Promise<unknown>;
}


interface NutritionEstimate {
  carbsGrams: number;
  proteinGrams: number;
  fatGrams: number;
  fiberGrams: number;
  sugarGrams: number;
  calories: number;
  portionSize: PortionSize;
  note: string;
}

const PORTIONS: PortionSize[] = ["small", "medium", "large"];

const TYPES: { value: EntryType; icon: typeof Apple; en: string; es: string }[] = [
  { value: "food", icon: Apple, en: "Food", es: "Comida" },
  { value: "drink", icon: Coffee, en: "Drink", es: "Bebida" },
  { value: "med", icon: Pill, en: "Medication", es: "Medicina" },
];

/** Convert an ISO timestamp to the `YYYY-MM-DDTHH:mm` local value a datetime-local input expects. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const round = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);

export function EditLogSheet({ log, open, onOpenChange, onSave }: Props) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const es = lang === "es";
  const [type, setType] = useState<EntryType>("food");
  const [label, setLabel] = useState("");
  const [carbs, setCarbs] = useState("");
  const [portion, setPortion] = useState<PortionSize | null>(null);
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [looking, setLooking] = useState(false);
  const [estimate, setEstimate] = useState<NutritionEstimate | null>(null);
  const [nutrition, setNutrition] = useState<Omit<EditPatch, "type" | "label" | "carbsGrams" | "portionSize" | "loggedAt" | "notes"> | null>(null);

  useEffect(() => {
    if (!log || !open) return;
    setType(log.type);
    setLabel(log.label);
    setCarbs(log.carbs_grams != null ? String(log.carbs_grams) : "");
    setPortion(log.portion_size ?? null);
    setWhen(toLocalInput(log.logged_at));
    setNotes(log.notes ?? "");
    setEstimate(null);
    setNutrition(null);
  }, [log, open]);

  const lookUpNutrition = async () => {
    if (!label.trim()) return;
    setLooking(true);
    setEstimate(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-nutrition", {
        body: { label: label.trim(), portionSize: portion, type, lang },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEstimate(data as NutritionEstimate);
    } catch (err) {
      console.error("nutrition lookup failed", err);
      toast({
        title: es ? "No pudimos estimar la nutrición" : "Couldn't estimate nutrition",
        variant: "destructive",
      });
    } finally {
      setLooking(false);
    }
  };

  const acceptEstimate = () => {
    if (!estimate) return;
    setCarbs(String(round(estimate.carbsGrams)));
    if (estimate.portionSize) setPortion(estimate.portionSize);
    setNutrition({
      proteinG: round(estimate.proteinGrams),
      fatG: round(estimate.fatGrams),
      fiberG: round(estimate.fiberGrams),
      sugarG: round(estimate.sugarGrams),
      calories: round(estimate.calories),
    });
    setEstimate(null);
  };

  const save = async () => {
    if (!log || !label.trim() || !when) return;
    setSaving(true);
    const parsedCarbs = carbs.trim() === "" ? null : Math.max(0, Math.round(Number(carbs)));
    const isMed = type === "med";
    await onSave(log.id, {
      type,
      label: label.trim().slice(0, 120),
      carbsGrams: isMed ? null : parsedCarbs != null && Number.isFinite(parsedCarbs) ? parsedCarbs : null,
      portionSize: isMed ? null : portion,
      loggedAt: new Date(when).toISOString(),
      notes: notes.trim() ? notes.trim().slice(0, 500) : null,
      ...(isMed
        ? { proteinG: null, fatG: null, fiberG: null, sugarG: null, calories: null }
        : nutrition ?? {}),
    });
    setSaving(false);
    onOpenChange(false);
  };

  const macro = (labelText: string, value: number, unit = "g") => (
    <div className="rounded-xl bg-background/60 px-3 py-2">
      <p className="text-xs text-muted-foreground">{labelText}</p>
      <p className="text-base font-semibold text-foreground">{round(value)}{unit}</p>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[92vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="text-2xl">{es ? "Editar entrada" : "Edit entry"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pt-4 pb-8">
          <div className="space-y-1.5">
            <Label className="text-base">{es ? "Tipo de entrada" : "Entry type"}</Label>
            <div className="flex gap-2">
              {TYPES.map(({ value, icon: Icon, en, es: esLabel }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-sm font-medium transition-colors",
                    type === value ? "border-primary bg-primary/5 text-foreground" : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {es ? esLabel : en}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-label" className="text-base">{es ? "Qué fue" : "What it was"}</Label>
            <Input id="edit-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} className="h-12 text-base rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-when" className="text-base">{es ? "Fecha y hora" : "Date & time"}</Label>
            <Input id="edit-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-12 text-base rounded-xl" />
          </div>

          {type !== "med" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="edit-carbs" className="text-base">{es ? "Carbohidratos (g)" : "Carbs (grams)"}</Label>
                <Input
                  id="edit-carbs"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={500}
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  placeholder={es ? "Opcional" : "Optional"}
                  className="h-12 text-base rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-base">{es ? "Tamaño de porción" : "Portion size"}</Label>
                <div className="flex gap-2">
                  {PORTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPortion(portion === p ? null : p)}
                      className={cn(
                        "flex-1 py-3 rounded-xl border-2 text-base font-medium capitalize transition-colors",
                        portion === p ? "border-primary bg-primary/5 text-foreground" : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {es ? { small: "Pequeña", medium: "Mediana", large: "Grande" }[p] : p}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl text-base"
                disabled={!label.trim() || looking}
                onClick={lookUpNutrition}
              >
                {looking ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> {es ? "Buscando…" : "Looking up…"}</>
                ) : (
                  <><Sparkles className="w-5 h-5 mr-2" /> {es ? "Buscar nutrición" : "Look up nutrition"}</>
                )}
              </Button>

              {estimate && (
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-3 space-y-3 animate-fade-in">
                  <p className="text-sm font-semibold text-foreground">
                    {es ? "Estimación — revisa y acepta" : "Estimate — review and accept"}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {macro(es ? "Carbohidratos" : "Carbs", estimate.carbsGrams)}
                    {macro(es ? "Proteína" : "Protein", estimate.proteinGrams)}
                    {macro(es ? "Grasa" : "Fat", estimate.fatGrams)}
                    {macro(es ? "Fibra" : "Fiber", estimate.fiberGrams)}
                    {macro(es ? "Azúcar" : "Sugar", estimate.sugarGrams)}
                    {macro(es ? "Calorías" : "Calories", estimate.calories, "")}
                  </div>
                  {estimate.note && <p className="text-xs text-muted-foreground">{estimate.note}</p>}
                  <p className="text-xs text-muted-foreground">
                    {es ? "Son estimaciones aproximadas, no valores médicos." : "These are rough estimates, not medical values."}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setEstimate(null)}>
                      {es ? "Descartar" : "Discard"}
                    </Button>
                    <Button className="flex-1 h-11 rounded-xl" onClick={acceptEstimate}>
                      <Check className="w-4 h-4 mr-2" /> {es ? "Aceptar" : "Accept"}
                    </Button>
                  </div>
                </div>
              )}

              {!estimate && nutrition && (
                <p className="text-sm text-muted-foreground">
                  {es ? "Nutrición aceptada — guarda para aplicarla." : "Nutrition accepted — save to apply."}
                </p>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-notes" className="text-base">{es ? "Notas" : "Notes"}</Label>
            <Input
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder={es ? "Opcional" : "Optional"}
              className="h-12 text-base rounded-xl"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 h-12 rounded-xl text-base" onClick={() => onOpenChange(false)}>
              {es ? "Cancelar" : "Cancel"}
            </Button>
            <Button className="flex-1 h-12 rounded-xl text-base" disabled={saving || !label.trim() || !when} onClick={save}>
              {saving ? (es ? "Guardando…" : "Saving…") : es ? "Guardar" : "Save changes"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
