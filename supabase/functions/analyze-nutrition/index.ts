import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { label, portionSize, type = "food", lang = "en" } = await req.json();
    if (!label || typeof label !== "string") {
      return new Response(JSON.stringify({ error: "Provide a label" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langLabel = lang === "es" ? "Spanish" : "English";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              `You estimate nutrition for a senior-friendly health app. Given an item name and portion, ` +
              `estimate typical nutrition values. Be approximate — general awareness only, never medical precision. ` +
              `If the item is a medication or nutrition is unknowable, return zeros and say so in the note. ` +
              `Write the note in ${langLabel}, one short sentence, no medical advice.`,
          },
          {
            role: "user",
            content: `Item type: ${type}. Item: "${label}". Portion: ${portionSize ?? "unspecified"}.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "estimate_nutrition",
              description: "Return approximate nutrition values for the item.",
              parameters: {
                type: "object",
                properties: {
                  carbsGrams: { type: "number" },
                  proteinGrams: { type: "number" },
                  fatGrams: { type: "number" },
                  fiberGrams: { type: "number" },
                  sugarGrams: { type: "number" },
                  calories: { type: "number" },
                  portionSize: { type: "string", enum: ["small", "medium", "large"] },
                  note: { type: "string" },
                },
                required: [
                  "carbsGrams",
                  "proteinGrams",
                  "fatGrams",
                  "fiberGrams",
                  "sugarGrams",
                  "calories",
                  "portionSize",
                  "note",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "estimate_nutrition" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Failed to estimate nutrition" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      return new Response(JSON.stringify({ error: "Could not estimate nutrition" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(args, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("analyze-nutrition error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
