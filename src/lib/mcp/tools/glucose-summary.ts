import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const LOW = 70;
const HIGH = 180;

export default defineTool({
  name: "glucose_summary",
  title: "Glucose summary",
  description:
    "Summarize the signed-in person's continuous glucose readings over a period: average, time in range, and the most recent reading.",
  inputSchema: {
    days: z.number().int().optional().describe("How many days back to summarize. Defaults to 7."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const lookback = Math.min(Math.max(days ?? 7, 1), 90);
    const since = new Date(Date.now() - lookback * 864e5).toISOString();

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("cgm_readings")
      .select("ts, mg_dl, trend")
      .gte("ts", since)
      .order("ts", { ascending: false })
      .limit(20000);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const readings = data ?? [];
    if (readings.length === 0) {
      return {
        content: [{ type: "text", text: `No glucose readings in the last ${lookback} day(s).` }],
        structuredContent: { readings_count: 0, days: lookback },
      };
    }

    const values = readings.map((r) => Number(r.mg_dl));
    const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    const pct = (n: number) => Math.round((n / values.length) * 100);
    const inRange = pct(values.filter((v) => v >= LOW && v <= HIGH).length);
    const above = pct(values.filter((v) => v > HIGH).length);
    const below = pct(values.filter((v) => v < LOW).length);
    const latest = readings[0];

    return {
      content: [
        {
          type: "text",
          text:
            `Last ${lookback} day(s): average ${avg} mg/dL across ${readings.length} readings. ` +
            `Time in range ${inRange}% (above ${above}%, below ${below}%). ` +
            `Most recent: ${Math.round(Number(latest.mg_dl))} mg/dL at ${latest.ts}.`,
        },
      ],
      structuredContent: {
        days: lookback,
        readings_count: readings.length,
        average_mg_dl: avg,
        time_in_range_pct: inRange,
        time_above_range_pct: above,
        time_below_range_pct: below,
        latest: { mg_dl: Number(latest.mg_dl), ts: latest.ts, trend: latest.trend },
      },
    };
  },
});
