import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "daily_insight",
  title: "Daily insight",
  description:
    "Fetch the most recent personalized daily insight generated for the signed-in person, including its narrative and suggestions.",
  inputSchema: {
    date: z.string().optional().describe("Specific day as YYYY-MM-DD. Defaults to the latest available."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("daily_insights")
      .select("insight_date, narrative, recommendations, metrics, data_sufficiency")
      .order("insight_date", { ascending: false })
      .limit(1);
    if (date) query = query.eq("insight_date", date);

    const { data, error } = await query.maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return {
        content: [{ type: "text", text: "No insight available for that day yet." }],
        structuredContent: { insight: null },
      };
    }

    const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
    const text = [
      `Insight for ${data.insight_date}:`,
      data.narrative ?? "(no narrative)",
      recs.length ? `Suggestions:\n${recs.map((r) => `- ${typeof r === "string" ? r : JSON.stringify(r)}`).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return { content: [{ type: "text", text }], structuredContent: { insight: data } };
  },
});
