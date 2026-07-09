// Runs weekly via pg_cron. Iterates over all users with recent activity
// and stores an auto-generated health report summary row per user.
// Deduplicates by (user_id, report_type='weekly', report_end_date).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Reading { ts: string; mg_dl: number }

function computeStats(readings: Reading[]) {
  if (readings.length === 0) return { count: 0, avg: null, tir: 0, tar: 0, tbr: 0, gmi: null };
  const vals = readings.map((r) => Number(r.mg_dl));
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const inR = vals.filter((v) => v >= 70 && v <= 180).length;
  const above = vals.filter((v) => v > 180).length;
  const below = vals.filter((v) => v < 70).length;
  return {
    count: vals.length,
    avg: Math.round(avg * 10) / 10,
    tir: Math.round((inR / vals.length) * 1000) / 10,
    tar: Math.round((above / vals.length) * 1000) / 10,
    tbr: Math.round((below / vals.length) * 1000) / 10,
    gmi: Math.round((3.31 + 0.02392 * avg) * 100) / 100,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const end = new Date();
    const start = new Date(end.getTime() - 7 * 86400000);
    const startISO = start.toISOString();
    const endISO = end.toISOString();
    const startDate = startISO.slice(0, 10);
    const endDate = endISO.slice(0, 10);

    // Users with activity in the last week (via food_logs or cgm_readings)
    const [{ data: fl }, { data: cg }] = await Promise.all([
      admin.from("food_logs").select("user_id").gte("logged_at", startISO),
      admin.from("cgm_readings").select("user_id").gte("ts", startISO),
    ]);
    const userIds = new Set<string>();
    (fl ?? []).forEach((r: { user_id: string }) => userIds.add(r.user_id));
    (cg ?? []).forEach((r: { user_id: string }) => userIds.add(r.user_id));

    let created = 0;
    for (const userId of userIds) {
      const [{ data: cgm }, { data: logs }, { data: meds }, { count: existing }] = await Promise.all([
        admin.from("cgm_readings").select("ts,mg_dl").eq("user_id", userId).gte("ts", startISO).lte("ts", endISO),
        admin.from("food_logs").select("id,type").eq("user_id", userId).gte("logged_at", startISO).lte("logged_at", endISO),
        admin.from("medication_events").select("id").eq("user_id", userId).gte("taken_at", startISO).lte("taken_at", endISO),
        admin.from("reports").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("report_type", "weekly").eq("report_end_date", endDate),
      ]);
      if ((existing ?? 0) > 0) continue;

      const stats = computeStats((cgm as Reading[]) ?? []);
      const mealCount = ((logs as { type: string }[]) ?? []).filter((l) => l.type === "food" || l.type === "drink").length;
      const medCount = ((meds as unknown[]) ?? []).length;

      const summary = stats.count > 0
        ? `Weekly summary: average glucose ${stats.avg} mg/dL with ${stats.tir}% Time In Range. ${mealCount} meals and ${medCount} medication events logged.`
        : `Weekly summary: ${mealCount} meals and ${medCount} medication events logged. No glucose readings recorded this week.`;

      const { error } = await admin.from("reports").insert({
        user_id: userId,
        report_type: "weekly",
        report_start_date: startDate,
        report_end_date: endDate,
        generated_by: "auto",
        summary,
        stats: { cgm: stats, mealCount, medCount },
      });
      if (!error) created++;
    }

    return new Response(JSON.stringify({ ok: true, users: userIds.size, created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-weekly-report", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
