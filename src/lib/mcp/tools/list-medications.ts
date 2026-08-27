import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_medications",
  title: "List medications",
  description:
    "List the signed-in person's medications, with recent doses taken. Read-only — this never changes a prescription.",
  inputSchema: {
    include_stopped: z.boolean().optional().describe("Include medications no longer taken. Defaults to false."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_stopped }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("medications")
      .select("id, name, med_class, dose, unit, schedule_cron, started_at, stopped_at")
      .order("started_at", { ascending: false })
      .limit(100);
    if (!include_stopped) query = query.is("stopped_at", null);

    const { data: meds, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data: events } = await supabase
      .from("medication_events")
      .select("medication_id, taken_at, dose")
      .gte("taken_at", since)
      .order("taken_at", { ascending: false })
      .limit(200);

    const rows = meds ?? [];
    const summary = rows.length
      ? rows
          .map((m) => {
            const last = (events ?? []).find((e) => e.medication_id === m.id);
            return `${m.name}${m.dose ? ` ${m.dose}${m.unit ?? ""}` : ""} (${m.med_class})` +
              (last ? ` — last taken ${last.taken_at}` : " — no doses logged this week");
          })
          .join("\n")
      : "No medications on file.";

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { medications: rows, recent_doses: events ?? [] },
    };
  },
});
