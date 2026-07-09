import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { HealthReport, FoodLogRow, MedEventRow, MedicationRow, MealResponseRow } from "./healthReport";

interface Meta {
  participantId?: string | null;
  userName: string;
  lang: "en" | "es";
}

export function renderHealthReportPdf(
  report: HealthReport,
  logs: FoodLogRow[],
  medEvents: MedEventRow[],
  medications: MedicationRow[],
  mealResponses: MealResponseRow[],
  meta: Meta,
): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 40;
  const isEs = meta.lang === "es";
  let y = 48;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor("#3f6b52");
  doc.text("Calm-Glucose", marginX, y);
  doc.setFontSize(14);
  doc.setTextColor("#111");
  doc.text(isEs ? "Reporte de Salud" : "Health Report", pageW - marginX, y, { align: "right" });
  y += 20;
  doc.setDrawColor(200);
  doc.line(marginX, y, pageW - marginX, y);
  y += 20;

  // Participant info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#333");
  const generated = new Date().toLocaleString(isEs ? "es-ES" : "en-US");
  const range = `${report.startDate} → ${report.endDate}`;
  doc.text(`${isEs ? "Nombre" : "Name"}: ${meta.userName}`, marginX, y); y += 14;
  if (meta.participantId) { doc.text(`${isEs ? "ID Participante" : "Participant ID"}: ${meta.participantId}`, marginX, y); y += 14; }
  doc.text(`${isEs ? "Generado" : "Generated"}: ${generated}`, marginX, y); y += 14;
  doc.text(`${isEs ? "Rango" : "Range"}: ${range}`, marginX, y); y += 18;

  // Summary block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(isEs ? "Resumen" : "Summary", marginX, y); y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const summaryLines = doc.splitTextToSize(report.summaryText, pageW - marginX * 2);
  doc.text(summaryLines, marginX, y); y += summaryLines.length * 12 + 6;

  // CGM Summary table
  section(doc, isEs ? "Resumen de MCG" : "CGM Summary", y); y += 6;
  autoTable(doc, {
    startY: y + 4,
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [63, 107, 82] },
    head: [[isEs ? "Métrica" : "Metric", isEs ? "Valor" : "Value"]],
    body: [
      [isEs ? "Glucosa promedio" : "Average glucose", val(report.cgm.avg, "mg/dL")],
      [isEs ? "GMI estimado" : "Estimated GMI", val(report.cgm.gmi, "%")],
      [isEs ? "Tiempo en Rango" : "Time In Range", `${report.cgm.tir}%`],
      [isEs ? "Tiempo sobre Rango" : "Time Above Range", `${report.cgm.tar}%`],
      [isEs ? "Tiempo bajo Rango" : "Time Below Range", `${report.cgm.tbr}%`],
      [isEs ? "Máximo" : "Highest", val(report.cgm.max, "mg/dL")],
      [isEs ? "Mínimo" : "Lowest", val(report.cgm.min, "mg/dL")],
      [isEs ? "Desviación estándar" : "Standard deviation", val(report.cgm.std, "mg/dL")],
      [isEs ? "Coeficiente de variación" : "Coefficient of variation", val(report.cgm.cv, "%")],
      [isEs ? "Lecturas totales" : "Total CGM readings", String(report.cgm.count)],
      [isEs ? "% uso del sensor" : "Sensor wear %", val(report.cgm.sensorWearPct, "%")],
    ],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  // Daily table
  y = ensureSpace(doc, y, 80);
  section(doc, isEs ? "Estadísticas diarias" : "Daily Glucose Statistics", y); y += 4;
  autoTable(doc, {
    startY: y + 4,
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [63, 107, 82] },
    head: [[isEs ? "Fecha" : "Date", isEs ? "Promedio" : "Avg", "TIR %", isEs ? "Máx" : "Max", isEs ? "Mín" : "Min", isEs ? "Lecturas" : "Readings"]],
    body: report.daily.map((d) => [d.date, val(d.avg), `${d.tir}`, val(d.max), val(d.min), String(d.count)]),
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  // Food logs
  y = ensureSpace(doc, y, 80);
  section(doc, isEs ? "Registro de comidas" : "Food Log Summary", y); y += 4;
  doc.setFontSize(9);
  doc.text(`${isEs ? "Total" : "Total"}: ${report.foodSummary.total}    ${isEs ? "Carbos prom" : "Avg carbs"}: ${val(report.foodSummary.avgCarbs, "g")}`, marginX, y + 12); y += 18;
  const responseByLog = new Map(mealResponses.map((r) => [r.food_log_id, r]));
  const foodRows = logs.filter((l) => l.type === "food" || l.type === "drink").map((l) => {
    const r = responseByLog.get(l.id);
    return [
      l.logged_at.slice(0, 10),
      new Date(l.logged_at).toLocaleTimeString(isEs ? "es-ES" : "en-US", { hour: "numeric", minute: "2-digit" }),
      l.label,
      l.carbs_grams != null ? `${l.carbs_grams}g` : "—",
      l.portion_size ?? "—",
      l.source,
      r?.meal_score != null ? String(r.meal_score) : "—",
      r?.peak_mg_dl != null ? String(r.peak_mg_dl) : "—",
      r?.recovery_time_min != null ? `${r.recovery_time_min}m` : "—",
    ];
  });
  autoTable(doc, {
    startY: y + 4,
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 8 },
    headStyles: { fillColor: [63, 107, 82] },
    head: [[isEs ? "Fecha" : "Date", isEs ? "Hora" : "Time", isEs ? "Comida" : "Meal", "Carbs", isEs ? "Porción" : "Portion", isEs ? "Fuente" : "Source", "Score", "Peak", isEs ? "Recup" : "Recovery"]],
    body: foodRows.length ? foodRows : [[isEs ? "Sin comidas registradas" : "No meals logged", "", "", "", "", "", "", "", ""]],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  // Medications
  y = ensureSpace(doc, y, 80);
  section(doc, isEs ? "Medicamentos" : "Medication Summary", y); y += 4;
  doc.setFontSize(9);
  doc.text(`${isEs ? "Total" : "Total"}: ${report.medSummary.total}    ${isEs ? "Insulina" : "Insulin"}: ${report.medSummary.insulinCount}    ${isEs ? "Otros" : "Other"}: ${report.medSummary.otherCount}`, marginX, y + 12); y += 18;
  const medById = new Map(medications.map((m) => [m.id, m]));
  const medRows = medEvents.map((e) => {
    const m = medById.get(e.medication_id);
    return [
      e.taken_at.slice(0, 10),
      new Date(e.taken_at).toLocaleTimeString(isEs ? "es-ES" : "en-US", { hour: "numeric", minute: "2-digit" }),
      m?.name ?? "—",
      m?.med_class ?? "—",
      e.dose != null ? `${e.dose}${m?.unit ?? ""}` : "—",
    ];
  });
  autoTable(doc, {
    startY: y + 4,
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 8 },
    headStyles: { fillColor: [63, 107, 82] },
    head: [[isEs ? "Fecha" : "Date", isEs ? "Hora" : "Time", isEs ? "Nombre" : "Name", isEs ? "Tipo" : "Type", isEs ? "Dosis" : "Dose"]],
    body: medRows.length ? medRows : [[isEs ? "Sin medicamentos registrados" : "No medications logged", "", "", "", ""]],
  });

  // Footer / page numbers
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor("#666");
    doc.text(
      isEs
        ? `Calm-Glucose · Reporte de Salud · Página ${p} de ${total}`
        : `Calm-Glucose · Health Report · Page ${p} of ${total}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" },
    );
  }

  return doc;
}

function val(n: number | null | undefined, unit = ""): string {
  if (n == null) return "—";
  return unit ? `${n} ${unit}` : String(n);
}

function section(doc: jsPDF, title: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor("#3f6b52");
  doc.text(title, 40, y);
  doc.setTextColor("#111");
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + needed > h - 40) {
    doc.addPage();
    return 48;
  }
  return y;
}

export function healthReportCsv(
  report: HealthReport,
  logs: FoodLogRow[],
  medEvents: MedEventRow[],
  medications: MedicationRow[],
): string {
  const lines: string[] = [];
  const push = (row: (string | number | null)[]) =>
    lines.push(row.map((c) => {
      const s = c == null ? "" : String(c);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","));

  push(["section", "field", "value"]);
  push(["range", "start", report.startDate]);
  push(["range", "end", report.endDate]);
  Object.entries(report.cgm).forEach(([k, v]) => push(["cgm", k, v as string | number | null]));
  push(["food", "total", report.foodSummary.total]);
  push(["food", "avg_carbs", report.foodSummary.avgCarbs]);
  push(["meds", "total", report.medSummary.total]);
  push(["meds", "insulin", report.medSummary.insulinCount]);
  push([]);

  push(["daily.date", "avg", "tir_pct", "max", "min", "readings"]);
  report.daily.forEach((d) => push([d.date, d.avg, d.tir, d.max, d.min, d.count]));
  push([]);

  push(["food.date", "time", "label", "carbs_g", "portion", "source", "type"]);
  logs.forEach((l) => push([
    l.logged_at.slice(0, 10),
    l.logged_at.slice(11, 16),
    l.label,
    l.carbs_grams,
    l.portion_size,
    l.source,
    l.type,
  ]));
  push([]);

  const medById = new Map(medications.map((m) => [m.id, m]));
  push(["med.date", "time", "name", "med_class", "dose", "unit", "source"]);
  medEvents.forEach((e) => {
    const m = medById.get(e.medication_id);
    push([
      e.taken_at.slice(0, 10),
      e.taken_at.slice(11, 16),
      m?.name ?? "",
      m?.med_class ?? "",
      e.dose,
      m?.unit ?? "",
      e.source,
    ]);
  });

  return lines.join("\n");
}
