// Generates a short, speech-optimized summary of the current screen using Lovable AI.
// Input: structured screen context (NOT raw HTML).
// Output: { script: string }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ScreenContext {
  screen: string; // e.g. "Now", "Progress", "Twin", "Circles", "Games", "Learn", "What If"
  status?: string; // one-line key takeaway
  highlights?: string[]; // up to ~5; LLM picks top 3
  data?: Record<string, unknown>; // optional structured numbers
  mode?: "brief" | "standard" | "detailed";
}

const MODE_RULES: Record<string, string> = {
  brief:
    "About 2 short sentences. Just the screen name and the single most important takeaway. No highlights list.",
  standard:
    "About 3-5 short sentences. Name the screen, give the key status, then 2-3 highlights as natural prose (not a list).",
  detailed:
    "About 5-8 short sentences. Name the screen, key status, up to 3 highlights with a touch of context, then end with the closing line.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ctx = (await req.json()) as ScreenContext;
    const mode = ctx.mode ?? "standard";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const system = `You are a calm, warm voice assistant for an elderly-focused health app called Greens Health.
Produce a SPOKEN summary of the screen the user is on. Plain language, short sentences, no jargon.
NEVER read button labels, navigation, or long lists of items.
Do NOT use markdown, emoji, parentheses, or numbers like "1." — write as natural speech.
Speak in second person ("you").
End with: "Want more detail?" — exactly once.
${MODE_RULES[mode]}`;

    const user = `Current screen: ${ctx.screen}
Key status: ${ctx.status ?? "(none provided)"}
Possible highlights:
${(ctx.highlights ?? []).map((h) => `- ${h}`).join("\n") || "(none)"}
Structured data: ${JSON.stringify(ctx.data ?? {})}

Write the spoken summary now.`;

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      },
    );

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limited" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "payment_required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "ai_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const script: string =
      data?.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(JSON.stringify({ script }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("speak-screen error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
