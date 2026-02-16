import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEXCOM_BASE_URL = "https://sandbox-api.dexcom.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const DEXCOM_CLIENT_ID = Deno.env.get("DEXCOM_CLIENT_ID");
  const DEXCOM_CLIENT_SECRET = Deno.env.get("DEXCOM_CLIENT_SECRET");

  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonClient = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!
  );
  const {
    data: { user },
    error: userError,
  } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Invalid authentication" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get stored tokens
  const { data: tokenData, error: tokenError } = await supabase
    .from("dexcom_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (tokenError || !tokenData) {
    return new Response(
      JSON.stringify({ error: "Dexcom not connected. Please connect first." }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let accessToken = tokenData.access_token;

  // Refresh token if expired
  if (new Date(tokenData.expires_at) <= new Date()) {
    if (!DEXCOM_CLIENT_ID || !DEXCOM_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "Dexcom credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const refreshRes = await fetch(`${DEXCOM_BASE_URL}/v2/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DEXCOM_CLIENT_ID,
        client_secret: DEXCOM_CLIENT_SECRET,
        refresh_token: tokenData.refresh_token,
        grant_type: "refresh_token",
        redirect_uri: `${req.headers.get("origin") || "https://localhost"}/dexcom/callback`,
      }),
    });

    if (!refreshRes.ok) {
      const errText = await refreshRes.text();
      console.error("Token refresh failed:", errText);
      return new Response(
        JSON.stringify({
          error: "Dexcom token expired. Please reconnect.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const newTokens = await refreshRes.json();
    accessToken = newTokens.access_token;
    const expiresAt = new Date(
      Date.now() + newTokens.expires_in * 1000
    ).toISOString();

    await supabase
      .from("dexcom_tokens")
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: expiresAt,
      })
      .eq("user_id", user.id);
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint") || "egvs";

    // Default: last 24 hours
    const now = new Date();
    const startDate =
      url.searchParams.get("startDate") ||
      new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const endDate = url.searchParams.get("endDate") || now.toISOString();

    // Fetch from Dexcom API
    const dexcomUrl = `${DEXCOM_BASE_URL}/v3/users/self/${endpoint}?startDate=${startDate}&endDate=${endDate}`;
    console.log("Fetching Dexcom data:", dexcomUrl);

    const dexcomRes = await fetch(dexcomUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!dexcomRes.ok) {
      const errText = await dexcomRes.text();
      console.error("Dexcom API error:", dexcomRes.status, errText);
      return new Response(
        JSON.stringify({
          error: `Dexcom API error: ${dexcomRes.status}`,
          details: errText,
        }),
        {
          status: dexcomRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const dexcomData = await dexcomRes.json();

    return new Response(JSON.stringify(dexcomData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Dexcom data fetch error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
