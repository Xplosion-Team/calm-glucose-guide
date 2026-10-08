import { createRunIdFetch } from "./aiRunId.ts";

export type PersonaType = "standard" | "comedian" | "celebrity" | "custom";
export type VoiceStyle = "encouraging" | "witty" | "direct" | "calm";

export interface PersonaPrefs {
  persona_type?: PersonaType | null;
  persona_name?: string | null;
  voice_style?: VoiceStyle | null;
}

interface NudgeFacts {
  purpose: "post_meal" | "inactive" | "test";
  requiredAction: string;
  context: string;
}

const toneFallback: Record<VoiceStyle, (facts: NudgeFacts) => string> = {
  encouraging: (f) => `You’re doing great keeping track 🌿 ${f.context} ${f.requiredAction}`,
  witty: (f) => `Quick check-in—your journal is ready for the latest 🌿 ${f.context} ${f.requiredAction}`,
  direct: (f) => `Quick check-in 🌿 ${f.context} ${f.requiredAction}`,
  calm: (f) => `A gentle check-in from Calm Glucose 🌿 ${f.context} ${f.requiredAction}`,
};

function safePrefs(prefs: PersonaPrefs) {
  const voice = (["encouraging", "witty", "direct", "calm"] as const).includes(prefs.voice_style as VoiceStyle)
    ? prefs.voice_style as VoiceStyle
    : "calm";
  const type = (["standard", "comedian", "celebrity", "custom"] as const).includes(prefs.persona_type as PersonaType)
    ? prefs.persona_type as PersonaType
    : "standard";
  const name = prefs.persona_name?.trim().slice(0, 80) || null;
  return { voice, type, name };
}

function fallback(facts: NudgeFacts, prefs: PersonaPrefs) {
  return toneFallback[safePrefs(prefs).voice](facts).replace(/\s+/g, " ").trim();
}

function valid(text: string, requiredAction: string) {
  const unsafe = /\b(diagnos|dose|dosage|insulin units|emergency|stupid|lazy|failure|idiot|damn|hell)\b/i;
  const actionWords = requiredAction.toLowerCase().match(/\b(reply|text|add|log)\b/g) ?? [];
  const actionPreserved = actionWords.length === 0 || actionWords.some((word) => text.toLowerCase().includes(word));
  return text.length >= 20 && text.length <= 320 && !unsafe.test(text) && actionPreserved;
}

function parseSse(text: string) {
  let output = "";
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
    try {
      const event = JSON.parse(line.slice(6));
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") output += event.delta;
    } catch { /* ignore non-JSON keepalive events */ }
  }
  return output.trim();
}

export async function generateNudge(facts: NudgeFacts, prefs: PersonaPrefs, signal?: AbortSignal) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const safe = safePrefs(prefs);
  if (!apiKey) return fallback(facts, prefs);

  const style = safe.type === "standard"
    ? "a gentle health companion"
    : safe.type === "comedian"
      ? "a warm, observational comedian"
      : `${safe.name || "the member's chosen personality"}-inspired energy`;
  const fetchWithRunId = createRunIdFetch();
  try {
    const response = await fetchWithRunId("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        input: [
          { role: "system", content: [{ type: "input_text", text: "Write one short SMS nudge for an older adult. Keep it warm, respectful, non-clinical, and under 320 characters. Preserve the required action. Never give medical advice, glucose thresholds, diagnoses, medication or dosing advice. Never shame, frighten, insult, swear, or coerce. Named people are only high-level inspiration: do not claim to be them, quote them, use signature catchphrases, or imitate them exactly. Return only the message." }] },
          { role: "user", content: [{ type: "input_text", text: `Style: ${style}. Tone: ${safe.voice}. Context: ${facts.context}. Required action: ${facts.requiredAction}` }] },
        ],
      }),
    });
    if (!response.ok) return fallback(facts, prefs);
    const text = parseSse(await response.text());
    return valid(text, facts.requiredAction) ? text : fallback(facts, prefs);
  } catch (error) {
    if (signal?.aborted) throw error;
    return fallback(facts, prefs);
  }
}