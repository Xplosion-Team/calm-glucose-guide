import { auth, defineMcp } from "@lovable.dev/mcp-js";
import logEntryTool from "./tools/log-entry";
import listEntriesTool from "./tools/list-entries";
import glucoseSummaryTool from "./tools/glucose-summary";
import listMedicationsTool from "./tools/list-medications";
import dailyInsightTool from "./tools/daily-insight";

// The OAuth issuer must be the direct Supabase host, built from the project ref
// (Vite inlines this at build time, so no runtime env read happens on import).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "gentle-glucose-companion",
  title: "Gentle Glucose Companion",
  version: "0.1.0",
  instructions:
    "Tools for Calm Glucose, a gentle glucose companion. Use `log_entry` to record food, drinks, " +
    "or medications; `list_entries` to review the journal; `glucose_summary` for average glucose and " +
    "time in range; `list_medications` for the current medication list; and `daily_insight` for the " +
    "latest personalized summary. Everything is scoped to the signed-in person. Never give medical " +
    "advice or clinical thresholds — suggest checking with their care team instead.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [logEntryTool, listEntriesTool, glucoseSummaryTool, listMedicationsTool, dailyInsightTool],
});
