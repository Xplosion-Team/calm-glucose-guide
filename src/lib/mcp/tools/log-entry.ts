import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "log_entry",
  title: "Log food, drink, or medication",
  description:
    "Add a food, drink, or medication entry to the signed-in person's journal. Use for statements like 'I had oatmeal for breakfast'.",
  inputSchema: {
    type: z.enum(["food", "drink", "med"]).describe("What kind of entry this is."),
    label: z.string().trim().describe("Short name of the item, e.g. 'oatmeal with berries'."),
    carbs_grams: z.number().int().optional().describe("Estimated carbohydrates in grams."),
    portion_size: z.enum(["small", "medium", "large"]).optional().describe("Portion size."),
    logged_at: z
      .string()
      .optional()
      .describe("ISO 8601 timestamp of when it was consumed. Defaults to now."),
    notes: z.string().optional().describe("Any extra detail worth keeping with the entry."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("food_logs")
      .insert({
        user_id: ctx.getUserId(),
        type: input.type,
        label: input.label,
        carbs_grams: input.carbs_grams ?? null,
        portion_size: input.portion_size ?? null,
        logged_at: input.logged_at ?? new Date().toISOString(),
        notes: input.notes ?? null,
        source: "text",
      })
      .select()
      .single();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Logged ${data.label} at ${data.logged_at}.` }],
      structuredContent: { entry: data },
    };
  },
});
