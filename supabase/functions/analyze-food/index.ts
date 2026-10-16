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

    const { imageBase64, images, text, lang = "en" } = await req.json();
    const photos = images ?? (imageBase64 ? [{ imageBase64, mimeType: "image/jpeg" }] : []);
    const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!Array.isArray(photos) || photos.length > 4 ||
      photos.some((p) => !p || typeof p.imageBase64 !== "string" || !p.imageBase64.length || p.imageBase64.length > 7 * 1024 * 1024 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(p.imageBase64) || !supportedTypes.includes(p.mimeType)) ||
      (text !== undefined && (typeof text !== "string" || text.length > 4000))) {
      return new Response(JSON.stringify({ error: "Provide up to four supported photos and a short meal description." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!photos.length && !text?.trim()) {
      return new Response(
        JSON.stringify({ error: "Provide imageBase64 or text" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const langLabel = lang === "es" ? "Spanish" : "English";

    const userContent: any[] = [];
    for (const photo of photos) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${photo.mimeType};base64,${photo.imageBase64}` },
      });
    }
    userContent.push({
      type: "text",
      text: text
        ? `The user described what they ate: "${text}". Use any attached photos together with this description to identify the whole meal, estimate total carbs and portion size. Multiple photos may show the same meal; do not count repeated views twice.`
        : "What food is this? Estimate the carbs and portion size.",
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a food recognition assistant for a senior-friendly health app. Identify the food (from image or description), estimate total carbohydrate content in grams, and assess portion size. Return the food name in ${langLabel}. Be approximate — for general awareness, not medical precision. If you cannot identify food, use foodName "Unknown".`,
          },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "identify_food",
              description: "Return structured food identification with carb estimate and portion size.",
              parameters: {
                type: "object",
                properties: {
                  foodName: { type: "string", description: `Name of the food in ${langLabel}` },
                  carbsGrams: { type: "number", description: "Estimated total carbohydrates in grams" },
                  portionSize: { type: "string", enum: ["small", "medium", "large"] },
                  category: { type: "string", enum: ["meal", "snack", "drink"] },
                },
                required: ["foodName", "carbsGrams", "portionSize", "category"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "identify_food" } },
      }),
    });

    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      const safeMessage = failure.message || failure.error?.message || "Photo analysis is unavailable. Please describe your meal in words.";
      return new Response(JSON.stringify({ error: safeMessage }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Could not identify food" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = JSON.parse(toolCall.function.arguments);
    if (typeof result.foodName !== "string" || !result.foodName.trim() || result.foodName.length > 300 ||
      typeof result.carbsGrams !== "number" || !Number.isFinite(result.carbsGrams) || result.carbsGrams < 0 ||
      !["small", "medium", "large"].includes(result.portionSize) || !["meal", "snack", "drink"].includes(result.category)) {
      return new Response(JSON.stringify({ error: "Could not identify the meal reliably. Please describe what you ate." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-food error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
