import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import type { FoodLog, PortionSize } from "@/hooks/useFoodLogs";

interface Props {
  log: FoodLog | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (
    id: string,
    patch: { label: string; carbsGrams: number | null; portionSize: PortionSize | null; loggedAt: string; notes: string | null },
  ) => Promise<unknown>;
}

const PORTIONS: PortionSize[] = ["small", "medium", "large"];

/** Convert an ISO timestamp to the `YYYY-MM-DDTHH:mm` local value a datetime-local input expects. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditLogSheet({ log, open, onOpenChange, onSave }: Props) {
  const { lang } = useI18n();
  const es = lang === "es";
  const [label, setLabel] = useState("");
  const [carbs, setCarbs] = useState("");
  const [portion, setPortion] = useState<PortionSize | null>(null);
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!log || !open) return;
    setLabel(log.label);
    setCarbs(log.carbs_grams != null ? String(log.carbs_grams) : "");
    setPortion(log.portion_size ?? null);
    setWhen(toLocalInput(log.logged_at));
    setNotes(log.notes ?? "");
  }, [log, open]);

  const save = async () => {
    if (!log || !label.trim() || !when) return;
    setSaving(true);
    const parsedCarbs = carbs.trim() === "" ? null : Math.max(0, Math.round(Number(carbs)));
    await onSave(log.id, {
      label: label.trim().slice(0, 120),
      carbsGrams: parsedCarbs != null && Number.isFinite(parsedCarbs) ? parsedCarbs : null,
      portionSize: portion,
      loggedAt: new Date(when).toISOString(),
      notes: notes.trim() ? notes.trim().slice(0, 500) : null,
    });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[92vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="text-2xl">{es ? "Editar entrada" : "Edit entry"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pt-4 pb-8">
          <div className="space-y-1.5">
            <Label htmlFor="edit-label" className="text-base">{es ? "Qué fue" : "What it was"}</Label>
            <Input id="edit-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} className="h-12 text-base rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-when" className="text-base">{es ? "Fecha y hora" : "Date & time"}</Label>
            <Input id="edit-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-12 text-base rounded-xl" />
          </div>

          {log?.type !== "med" && (
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
