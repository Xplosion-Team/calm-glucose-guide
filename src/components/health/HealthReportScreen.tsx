import { Component, useCallback, useEffect, useMemo, useState, type ReactNode, type ErrorInfo } from "react";
import { ArrowLeft, FileText, Download, Share2, Save, Loader2, Trash2, Sparkles, CalendarDays, AlertTriangle, Inbox } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  assembleReport, type CgmReading, type FoodLogRow, type MedEventRow, type MedicationRow, type MealResponseRow,
} from "@/lib/healthReport";
import { renderHealthReportPdf, healthReportCsv } from "@/lib/healthReportPdf";

// Toggle to visually verify the screen with fabricated data when the account
// has no CGM / food / medication entries yet. Set to false before production.
const ENABLE_MOCK_FALLBACK = true;

function buildMockData(): {
  readings: CgmReading[]; logs: FoodLogRow[]; medEvents: MedEventRow[]; medications: MedicationRow[];
} {
  const now = Date.now();
  const readings: CgmReading[] = Array.from({ length: 24 * 12 }, (_, i) => ({
    ts: new Date(now - (24 * 12 - i) * 5 * 60_000).toISOString(),
    mg_dl: 110 + Math.round(30 * Math.sin(i / 8) + (i % 7) * 3),
  }));
  const logs: FoodLogRow[] = [
    { id: "m1", type: "food", label: "Sample oatmeal", carbs_grams: 30, portion_size: "1 bowl", source: "mock", logged_at: new Date(now - 6 * 3600_000).toISOString() },
    { id: "m2", type: "drink", label: "Sample coffee", carbs_grams: 5, portion_size: "1 cup", source: "mock", logged_at: new Date(now - 3 * 3600_000).toISOString() },
  ];
  const medications: MedicationRow[] = [
    { id: "med1", name: "Metformin", med_class: "biguanide", dose: 500, unit: "mg" },
  ];
  const medEvents: MedEventRow[] = [
    { id: "e1", medication_id: "med1", taken_at: new Date(now - 8 * 3600_000).toISOString(), dose: 500, source: "mock" },
  ];
  return { readings, logs, medEvents, medications };
}


interface Props { onBack: () => void }

type RangeKey = "7d" | "14d" | "30d" | "enroll" | "custom";

interface SavedReport {
  id: string;
  report_type: string;
  report_start_date: string;
  report_end_date: string;
  generated_at: string;
  generated_by: string;
  summary: string | null;
}

export function HealthReportScreen(props: Props) {
  return (
    <HealthReportErrorBoundary onBack={props.onBack}>
      <HealthReportScreenInner {...props} />
    </HealthReportErrorBoundary>
  );
}

function HealthReportScreenInner({ onBack }: Props) {
  const { lang } = useI18n();
  const isEs = lang === "es";
  const { toast } = useToast();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  const [rangeKey, setRangeKey] = useState<RangeKey>("7d");
  const [start, setStart] = useState<Date>(() => new Date(Date.now() - 6 * 86400000));
  const [end, setEnd] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [profile, setProfile] = useState<{ name: string; participantId: string | null }>({
    name: "", participantId: null,
  });

  const [readings, setReadings] = useState<CgmReading[]>([]);
  const [logs, setLogs] = useState<FoodLogRow[]>([]);
  const [medEvents, setMedEvents] = useState<MedEventRow[]>([]);
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [responses, setResponses] = useState<MealResponseRow[]>([]);

  // Compute date range for preset selection
  useEffect(() => {
    const now = new Date();
    if (rangeKey === "7d") { setStart(new Date(now.getTime() - 6 * 86400000)); setEnd(now); }
    else if (rangeKey === "14d") { setStart(new Date(now.getTime() - 13 * 86400000)); setEnd(now); }
    else if (rangeKey === "30d") { setStart(new Date(now.getTime() - 29 * 86400000)); setEnd(now); }
    else if (rangeKey === "enroll") {
      (async () => {
        const { data } = await supabase.from("trial_enrollments").select("consented_at").maybeSingle();
        if (data?.consented_at) setStart(new Date(data.consented_at));
        setEnd(new Date());
      })();
    }
  }, [rangeKey]);

  // Fetch report data
  const loadData = useCallback(async () => {
    setLoading(true);
    const startISO = new Date(start.getFullYear(), start.getMonth(), start.getDate()).toISOString();
    const endISO = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).toISOString();

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const [{ data: prof }, { data: trial }] = await Promise.all([
        supabase.from("profiles").select("display_name").maybeSingle(),
        supabase.from("trial_enrollments").select("trial_id").maybeSingle(),
      ]);
      setProfile({
        name: prof?.display_name ?? session.user.email ?? "",
        participantId: trial?.trial_id ?? null,
      });
    }

    const [{ data: cgm }, { data: fl }, { data: me }, { data: meds }, { data: mr }, { data: rl }] = await Promise.all([
      supabase.from("cgm_readings").select("ts,mg_dl").gte("ts", startISO).lte("ts", endISO).order("ts"),
      supabase.from("food_logs").select("*").gte("logged_at", startISO).lte("logged_at", endISO).order("logged_at"),
      supabase.from("medication_events").select("*").gte("taken_at", startISO).lte("taken_at", endISO).order("taken_at"),
      supabase.from("medications").select("*"),
      supabase.from("meal_responses").select("food_log_id,meal_score,peak_mg_dl,recovery_time_min").eq("status", "ready"),
      supabase.from("reports").select("*").order("generated_at", { ascending: false }).limit(20),
    ]);

    setReadings((cgm as CgmReading[]) ?? []);
    setLogs((fl as FoodLogRow[]) ?? []);
    setMedEvents((me as MedEventRow[]) ?? []);
    setMedications((meds as MedicationRow[]) ?? []);
    setResponses((mr as MealResponseRow[]) ?? []);
    setSaved((rl as SavedReport[]) ?? []);
    setLoading(false);
  }, [start, end]);

  useEffect(() => { void loadData(); }, [loadData]);

  const startISO = useMemo(() => new Date(start.getFullYear(), start.getMonth(), start.getDate()).toISOString(), [start]);
  const endISO = useMemo(() => new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).toISOString(), [end]);

  const report = useMemo(
    () => assembleReport(readings, logs, medEvents, medications, startISO, endISO, isEs ? "es" : "en"),
    [readings, logs, medEvents, medications, startISO, endISO, isEs],
  );

  const trendData = useMemo(
    () => readings.map((r) => ({ t: new Date(r.ts).getTime(), mg_dl: Number(r.mg_dl) })),
    [readings],
  );

  const genPdf = useCallback(() => {
    return renderHealthReportPdf(report, logs, medEvents, medications, responses, {
      participantId: profile.participantId,
      userName: profile.name,
      lang: isEs ? "es" : "en",
    });
  }, [report, logs, medEvents, medications, responses, profile, isEs]);

  const downloadPdf = () => {
    const doc = genPdf();
    doc.save(`calm-glucose-report-${report.startDate}-${report.endDate}.pdf`);
  };

  const sharePdf = async () => {
    const doc = genPdf();
    const blob = doc.output("blob");
    const file = new File([blob], `calm-glucose-report-${report.startDate}.pdf`, { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Health Report" }); return; }
      catch { /* user cancelled */ }
    }
    downloadPdf();
  };

  const downloadCsv = () => {
    const csv = healthReportCsv(report, logs, medEvents, medications);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calm-glucose-report-${report.startDate}-${report.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveToHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    setSaving(true);
    const row = {
      user_id: session.user.id,
      report_type: rangeKey,
      report_start_date: report.startDate,
      report_end_date: report.endDate,
      generated_by: "manual",
      summary: report.summaryText,
      stats: { cgm: report.cgm, foodSummary: report.foodSummary, medSummary: report.medSummary } as never,
    };
    const { error } = await supabase.from("reports").insert(row as never);
    setSaving(false);
    if (error) {
      toast({ title: isEs ? "No se pudo guardar" : "Could not save", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isEs ? "Reporte guardado" : "Report saved" });
      void loadData();
    }
  };

  const deleteSaved = async (id: string) => {
    await supabase.from("reports").delete().eq("id", id);
    setSaved((prev) => prev.filter((r) => r.id !== id));
  };

  const loadSaved = (r: SavedReport) => {
    setRangeKey("custom");
    setStart(new Date(r.report_start_date));
    setEnd(new Date(r.report_end_date));
  };

  const ranges: { key: RangeKey; label: string }[] = [
    { key: "7d", label: isEs ? "7 días" : "Last 7 days" },
    { key: "14d", label: isEs ? "14 días" : "Last 14 days" },
    { key: "30d", label: isEs ? "30 días" : "Last 30 days" },
    { key: "enroll", label: isEs ? "Desde inscripción" : "Since enrollment" },
    { key: "custom", label: isEs ? "Personalizado" : "Custom" },
  ];

  return (
    <div className="space-y-4 animate-fade-in pb-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ArrowLeft className="w-4 h-4" /> {isEs ? "Volver" : "Back"}</Button>

      <header className="space-y-1">
        <h2 className="text-2xl font-semibold flex items-center gap-2"><FileText className="w-6 h-6 text-primary" /> {isEs ? "Reporte de Salud" : "Health Report"}</h2>
        <p className="text-sm text-muted-foreground">
          {isEs
            ? "Un resumen para compartir con su equipo de atención o de investigación."
            : "A summary to share with your care or research team."}
        </p>
      </header>

      {/* Range selector */}
      <Card className="glass-card border-0">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {ranges.map((r) => (
              <button
                key={r.key}
                onClick={() => setRangeKey(r.key)}
                className={cn(
                  "px-3 py-2 rounded-full text-sm font-medium border touch-target",
                  rangeKey === r.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border",
                )}
              >{r.label}</button>
            ))}
          </div>
          {rangeKey === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <DatePickerField label={isEs ? "Inicio" : "Start"} value={start} onChange={setStart} />
              <DatePickerField label={isEs ? "Fin" : "End"} value={end} onChange={setEnd} />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            <CalendarDays className="w-3 h-3 inline mr-1" />
            {format(start, "PP")} → {format(end, "PP")}
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Button onClick={downloadPdf} className="h-12 gap-1 rounded-xl"><Download className="w-4 h-4" /> PDF</Button>
        <Button onClick={sharePdf} variant="outline" className="h-12 gap-1 rounded-xl"><Share2 className="w-4 h-4" /> {isEs ? "Compartir" : "Share"}</Button>
        <Button onClick={downloadCsv} variant="outline" className="h-12 gap-1 rounded-xl"><Download className="w-4 h-4" /> CSV</Button>
        <Button onClick={saveToHistory} disabled={saving} variant="outline" className="h-12 gap-1 rounded-xl">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {isEs ? "Guardar" : "Save"}
        </Button>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Participant */}
          <ReportSection title={isEs ? "Participante" : "Participant"}>
            <KV label={isEs ? "Nombre" : "Name"} value={profile.name || "—"} />
            {profile.participantId && <KV label={isEs ? "ID Participante" : "Participant ID"} value={profile.participantId} />}
            <KV label={isEs ? "Generado" : "Generated"} value={new Date().toLocaleString(isEs ? "es-ES" : "en-US")} />
            <KV label={isEs ? "Rango" : "Range"} value={`${report.startDate} → ${report.endDate}`} />
          </ReportSection>

          {/* CGM summary */}
          <ReportSection title={isEs ? "Resumen MCG" : "CGM Summary"}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <KV label={isEs ? "Promedio" : "Average"} value={metric(report.cgm.avg, "mg/dL")} />
              <KV label="GMI" value={metric(report.cgm.gmi, "%")} />
              <KV label={isEs ? "T. en Rango" : "Time In Range"} value={`${report.cgm.tir}%`} />
              <KV label={isEs ? "T. sobre Rango" : "Time Above"} value={`${report.cgm.tar}%`} />
              <KV label={isEs ? "T. bajo Rango" : "Time Below"} value={`${report.cgm.tbr}%`} />
              <KV label={isEs ? "Máx" : "High"} value={metric(report.cgm.max, "mg/dL")} />
              <KV label={isEs ? "Mín" : "Low"} value={metric(report.cgm.min, "mg/dL")} />
              <KV label={isEs ? "Desv. Est." : "Std Dev"} value={metric(report.cgm.std, "mg/dL")} />
              <KV label="CV" value={metric(report.cgm.cv, "%")} />
              <KV label={isEs ? "Lecturas" : "Readings"} value={String(report.cgm.count)} />
              <KV label={isEs ? "Uso sensor" : "Sensor wear"} value={metric(report.cgm.sensorWearPct, "%")} />
            </div>
            {trendData.length > 1 && (
              <div className="h-48 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 8, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="t" type="number" domain={["auto", "auto"]} tick={{ fontSize: 10 }} tickFormatter={(t) => new Date(t).toLocaleDateString(isEs ? "es-ES" : "en-US", { month: "numeric", day: "numeric" })} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip labelFormatter={(t) => new Date(t as number).toLocaleString(isEs ? "es-ES" : "en-US")} formatter={(v: number) => [`${v} mg/dL`, "Glucose"]} />
                    <ReferenceLine y={180} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                    <ReferenceLine y={70} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="mg_dl" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ReportSection>

          {/* Daily stats */}
          {report.daily.length > 0 && (
            <ReportSection title={isEs ? "Estadísticas diarias" : "Daily Statistics"}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr><th className="text-left py-1">{isEs ? "Fecha" : "Date"}</th><th>Avg</th><th>TIR</th><th>Max</th><th>Min</th><th>#</th></tr>
                  </thead>
                  <tbody>
                    {report.daily.map((d) => (
                      <tr key={d.date} className="border-t border-border">
                        <td className="py-1.5">{d.date}</td><td className="text-center">{d.avg}</td>
                        <td className="text-center">{d.tir}%</td><td className="text-center">{d.max}</td>
                        <td className="text-center">{d.min}</td><td className="text-center">{d.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReportSection>
          )}

          {/* Food */}
          <ReportSection title={isEs ? "Comidas" : "Food Log"}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <KV label={isEs ? "Total" : "Total"} value={String(report.foodSummary.total)} />
              <KV label={isEs ? "Carbos prom." : "Avg carbs"} value={metric(report.foodSummary.avgCarbs, "g")} />
            </div>
            {report.foodSummary.top.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{isEs ? "Más frecuentes" : "Most frequent"}</p>
                {report.foodSummary.top.map((t) => (
                  <div key={t.label} className="flex justify-between text-sm">
                    <span>{t.label}</span><span className="text-muted-foreground">{t.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </ReportSection>

          {/* Medications */}
          <ReportSection title={isEs ? "Medicamentos" : "Medications"}>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <KV label={isEs ? "Total" : "Total"} value={String(report.medSummary.total)} />
              <KV label={isEs ? "Insulina" : "Insulin"} value={String(report.medSummary.insulinCount)} />
              <KV label={isEs ? "Otros" : "Other"} value={String(report.medSummary.otherCount)} />
            </div>
          </ReportSection>

          {/* Summary */}
          <ReportSection title={isEs ? "Resumen del reporte" : "Report Summary"}>
            <p className="text-sm text-foreground leading-relaxed">{report.summaryText}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {isEs
                ? "Datos objetivos. Este reporte no contiene consejos médicos."
                : "Objective data. This report does not contain medical advice."}
            </p>
          </ReportSection>
        </>
      )}

      {/* History */}
      <section className="space-y-2 pt-2">
        <h3 className="text-base font-semibold text-foreground px-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> {isEs ? "Reportes anteriores" : "Previous Reports"}
        </h3>
        {saved.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">
            {isEs ? "Aún no hay reportes guardados." : "No saved reports yet."}
          </p>
        ) : saved.map((r) => (
          <Card key={r.id} className="glass-card border-0">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.report_start_date} → {r.report_end_date}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{new Date(r.generated_at).toLocaleDateString(isEs ? "es-ES" : "en-US")}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {r.generated_by === "auto" ? (isEs ? "Auto" : "Auto") : (isEs ? "Manual" : "Manual")}
                  </Badge>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => loadSaved(r)}>{isEs ? "Ver" : "View"}</Button>
              <Button variant="ghost" size="icon" onClick={() => deleteSaved(r.id)} aria-label="Delete">
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

function DatePickerField({ label, value, onChange }: { label: string; value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start h-11 rounded-xl">
            <CalendarDays className="w-4 h-4 mr-2" />
            {format(value, "PP")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={(d) => { if (d) { onChange(d); setOpen(false); } }} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="glass-card border-0">
      <CardContent className="p-4 space-y-2">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

function metric(n: number | null | undefined, unit = ""): string {
  if (n == null) return "—";
  return unit ? `${n} ${unit}` : String(n);
}
