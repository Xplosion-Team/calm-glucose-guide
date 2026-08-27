import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_entries",
  title: "List journal entries",
  description:
    "Read recent food, drink, and medication entries from the signed-in person's journal, newest first.",
  inputSchema: {
    days: z.number().int().optional().describe("How many days back to look. Defaults to 1 (today)."),
    type: z.enum(["food", "drink", "med"]).optional().describe("Only return this kind of entry."),
    limit: z.number().int().optional().describe("Maximum entries to return. Defaults to 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days, type, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const lookback = Math.min(Math.max(days ?? 1, 1), 365);
    const max = Math.min(Math.max(limit ?? 50, 1), 200);
    const since = new Date(Date.now() - lookback * 864e5).toISOString();

    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("food_logs")
      .select("id, type, label, carbs_grams, portion_size, source, logged_at, notes")
      .gte("logged_at", since)
      .order("logged_at", { ascending: false })
      .limit(max);
    if (type) query = query.eq("type", type);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    const totalCarbs = rows.reduce((s, r) => s + (r.carbs_grams ?? 0), 0);
    const summary = rows.length
      ? rows
          .map((r) => `${r.logged_at} — ${r.label} (${r.type}${r.carbs_grams ? `, ~${r.carbs_grams}g carbs` : ""})`)
          .join("\n")
      : "No entries in that window.";

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { entries: rows, count: rows.length, total_carbs_grams: totalCarbs },
    };
  },
});
