import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pill, Plus, Check, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useMedications, type MedClass } from "@/hooks/useMedications";

const MED_CLASSES: { value: MedClass; label: string; unit: string }[] = [
  { value: "rapid_insulin", label: "Fast-acting insulin", unit: "units" },
  { value: "long_insulin", label: "Long-acting insulin", unit: "units" },
  { value: "sulfonylurea", label: "Sulfonylurea pill", unit: "mg" },
  { value: "metformin", label: "Metformin", unit: "mg" },
  { value: "glp1", label: "GLP-1 (Ozempic, Trulicity, etc.)", unit: "mg" },
  { value: "sglt2", label: "SGLT2 (Jardiance, Farxiga, etc.)", unit: "mg" },
  { value: "dpp4", label: "DPP-4 (Januvia, etc.)", unit: "mg" },
  { value: "other", label: "Other medication", unit: "" },
];

function formatTimeAgo(iso: string) {
  const min = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${Math.round(min)} min ago`;
  const hr = min / 60;
  if (hr < 24) return `${Math.round(hr)} hr ago`;
  return `${Math.round(hr / 24)} days ago`;
}

export default function MedicationsPage() {
  const navigate = useNavigate();
  const { meds, events, loading, addMedication, stopMedication, logDose } = useMedications();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [medClass, setMedClass] = useState<MedClass>("rapid_insulin");
  const [dose, setDose] = useState("");
  const [saving, setSaving] = useState(false);

  const unitFor = useMemo(
    () => MED_CLASSES.find((c) => c.value === medClass)?.unit ?? "",
    [medClass],
  );

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addMedication({
        name: name.trim(),
        med_class: medClass,
        dose: dose ? Number(dose) : undefined,
        unit: unitFor || undefined,
      });
      toast({ title: "Medication added" });
      setName(""); setDose(""); setShowAdd(false);
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLog = async (id: string, defaultDose: number | null) => {
    try {
      await logDose(id, defaultDose ?? undefined);
      toast({ title: "Dose logged" });
    } catch (e) {
      toast({
        title: "Could not log",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
            <ArrowLeft className="w-5 h-5" /> Back
          </Button>
        </div>

        <header className="space-y-1">
          <div className="inline-flex items-center gap-2">
            <Pill className="w-7 h-7 text-primary" aria-hidden />
            <h1 className="text-2xl font-semibold text-foreground">Your medications</h1>
          </div>
          <p className="text-base text-muted-foreground">
            Add your medications and tap when you take a dose. We'll factor recent
            doses into your glucose guidance.
          </p>
        </header>

        {/* Add new */}
        {!showAdd ? (
          <Button onClick={() => setShowAdd(true)} className="w-full h-12 rounded-xl text-base gap-2">
            <Plus className="w-5 h-5" /> Add a medication
          </Button>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add a medication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="med-name" className="text-base">Name</Label>
                <Input
                  id="med-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Humalog"
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Type</Label>
                <Select value={medClass} onValueChange={(v) => setMedClass(v as MedClass)}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MED_CLASSES.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-base">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-dose" className="text-base">
                  Typical dose {unitFor && <span className="text-muted-foreground">({unitFor})</span>}
                </Label>
                <Input
                  id="med-dose"
                  type="number"
                  inputMode="decimal"
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  placeholder="optional"
                  className="h-12 text-base"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={submit} disabled={saving || !name.trim()} className="flex-1 h-12 rounded-xl">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Check className="w-5 h-5 mr-2" />}
                  Save
                </Button>
                <Button variant="ghost" onClick={() => setShowAdd(false)} className="h-12 rounded-xl">
                  <X className="w-5 h-5 mr-1" /> Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Med list */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-foreground">Current medications</h2>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : meds.length === 0 ? (
            <p className="text-muted-foreground">No medications added yet.</p>
          ) : (
            meds.map((m) => {
              const lastEvent = events.find((e) => e.medication_id === m.id);
              const label = MED_CLASSES.find((c) => c.value === m.med_class)?.label ?? m.med_class;
              return (
                <Card key={m.id}>
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-foreground">{m.name}</div>
                        <div className="text-sm text-muted-foreground">{label}</div>
                        {m.dose != null && (
                          <div className="text-sm text-muted-foreground">
                            Usual dose: {m.dose} {m.unit ?? ""}
                          </div>
                        )}
                        {lastEvent && (
                          <div className="text-sm text-foreground/80 mt-1">
                            Last taken {formatTimeAgo(lastEvent.taken_at)}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => stopMedication(m.id)}
                        className="text-muted-foreground"
                        aria-label={`Stop ${m.name}`}
                      >
                        Stop
                      </Button>
                    </div>
                    <Button
                      onClick={() => handleLog(m.id, m.dose)}
                      className="w-full h-12 rounded-xl text-base"
                    >
                      I took this just now
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>

        <p className="text-xs text-muted-foreground text-center pt-4">
          This is not medical advice. Always follow your care team's guidance.
        </p>
      </div>
    </div>
  );
}

export function MedicationsLinkCard() {
  const navigate = useNavigate();
  return (
    <Card
      className="cursor-pointer hover:border-primary transition-colors"
      onClick={() => navigate("/medications")}
    >
      <CardContent className="pt-5 pb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Pill className="w-5 h-5" aria-hidden />
          </div>
          <div>
            <div className="text-base font-medium text-foreground">Medications</div>
            <div className="text-sm text-muted-foreground">
              Add meds and log when you take a dose.
            </div>
          </div>
        </div>
        <ArrowLeft className="w-5 h-5 rotate-180 text-muted-foreground" aria-hidden />
      </CardContent>
    </Card>
  );
}
