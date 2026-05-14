// Twilio SMS inbound webhook. Parses message text, runs analyze-food in text mode,
// inserts a food_log on behalf of the user matched by phone, and replies with TwiML.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function twiml(message: string) {
  const escaped = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const form = await req.formData();
    const from = (form.get("From") || "").toString();
    const body = (form.get("Body") || "").toString().trim();

    if (!from || !body) {
      return new Response(twiml("Sorry, I didn't catch that. Try again with what you ate or drank."), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Match user by phone in user_engagement
    const { data: eng } = await supabase
      .from("user_engagement")
      .select("user_id")
      .eq("phone", from)
      .maybeSingle();

    if (!eng?.user_id) {
      return new Response(twiml("Welcome! Please sign up in the Calm Glucose app to log meals via text."), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Call analyze-food in text mode
    const aiResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-food`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({ text: body, lang: "en" }),
    });

    let label = body.slice(0, 60);
    let carbs: number | null = null;
    let portion: string | null = null;
    if (aiResp.ok) {
      const j = await aiResp.json();
      label = j.foodName || label;
      carbs = j.carbsGrams ?? null;
      portion = j.portionSize ?? null;
    }

    await supabase.from("food_logs").insert({
      user_id: eng.user_id,
      type: "food",
      label,
      carbs_grams: carbs,
      portion_size: portion,
      source: "sms",
    });

    const reply = `Logged: ${label}${carbs ? ` (~${carbs}g carbs)` : ""}. Thanks for sharing 💚`;
    return new Response(twiml(reply), { headers: { "Content-Type": "text/xml" } });
  } catch (e) {
    console.error("sms-inbound error", e);
    return new Response(twiml("Something went wrong on my end. Please try again in a moment."), {
      headers: { "Content-Type": "text/xml" },
    });
  }
});
