import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Use sandbox API for development; switch to api.dexcom.com for production
const DEXCOM_BASE_URL = "https://sandbox-api.dexcom.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const DEXCOM_CLIENT_ID = Deno.env.get("DEXCOM_CLIENT_ID");
  const DEXCOM_CLIENT_SECRET = Deno.env.get("DEXCOM_CLIENT_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!DEXCOM_CLIENT_ID || !DEXCOM_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: "Dexcom credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Action 1: Generate the Dexcom authorization URL
    if (action === "authorize") {
      const redirectUri = url.searchParams.get("redirect_uri");
      if (!redirectUri) {
        return new Response(
          JSON.stringify({ error: "redirect_uri is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const authUrl = `${DEXCOM_BASE_URL}/v2/oauth2/login?client_id=${DEXCOM_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=offline_access`;

      return new Response(
        JSON.stringify({ url: authUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action 2: Exchange authorization code for tokens
    if (action === "callback") {
      const { code, redirect_uri } = await req.json();

      if (!code || !redirect_uri) {
        return new Response(
          JSON.stringify({ error: "code and redirect_uri are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user from auth header
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Not authenticated" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      const anonClient = createClient(
        SUPABASE_URL!,
        Deno.env.get("SUPABASE_ANON_KEY")!
      );
      const { data: { user }, error: userError } = await anonClient.auth.getUser(
        authHeader.replace("Bearer ", "")
      );

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid authentication" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Exchange code for tokens with Dexcom
      const tokenResponse = await fetch(`${DEXCOM_BASE_URL}/v2/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: DEXCOM_CLIENT_ID,
          client_secret: DEXCOM_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri,
        }),
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        console.error("Dexcom token exchange failed:", errText);
        return new Response(
          JSON.stringify({ error: "Failed to exchange code with Dexcom" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokens = await tokenResponse.json();
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Upsert tokens into database
      const { error: dbError } = await supabase
        .from("dexcom_tokens")
        .upsert(
          {
            user_id: user.id,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: expiresAt,
            scope: tokens.scope || null,
          },
          { onConflict: "user_id" }
        );

      if (dbError) {
        console.error("DB error storing tokens:", dbError);
        return new Response(
          JSON.stringify({ error: "Failed to store tokens" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use ?action=authorize or ?action=callback" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Dexcom auth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
