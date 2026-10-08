import { assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { generateNudge } from "../_shared/nudgePersona.ts";

Deno.test("safe fallback preserves an actionable logging request", async () => {
  const previous = Deno.env.get("LOVABLE_API_KEY");
  Deno.env.delete("LOVABLE_API_KEY");
  const text = await generateNudge({
    purpose: "inactive",
    context: "A meal has not been logged recently.",
    requiredAction: "Text back what you ate or drank.",
  }, { persona_type: "comedian", voice_style: "witty" });
  if (previous) Deno.env.set("LOVABLE_API_KEY", previous);
  assertMatch(text, /Text back what you ate or drank/i);
  assertMatch(text, /journal|check-in/i);
});