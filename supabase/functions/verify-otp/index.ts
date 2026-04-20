import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: "Phone and code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Find valid OTP
    const { data: otpRecord, error: otpError } = await supabase
      .from("phone_otps")
      .select("*")
      .eq("phone", phone)
      .eq("code", code)
      .eq("verified", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpRecord) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired code" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as verified
    await supabase.from("phone_otps").update({ verified: true }).eq("id", otpRecord.id);

    // Create or get user by phone
    // Use a deterministic email based on phone for the auth user
    const phoneEmail = `${phone.replace(/\D/g, "")}@phone.greenshealth.local`;
    const tempPassword = crypto.randomUUID();

    // Look up existing user by deterministic email. The admin SDK doesn't
    // expose a direct email lookup, so we query auth.users via the service
    // role (scales beyond listUsers() pagination limits).
    let existingUser: any = null;
    {
      const { data: userRow } = await supabase
        .schema("auth")
        .from("users")
        .select("id, email, phone")
        .eq("email", phoneEmail)
        .maybeSingle();
      if (userRow) {
        existingUser = userRow;
      }
    }

    let session;

    if (existingUser) {
      // Generate a magic link / sign in programmatically
      const { data, error } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: phoneEmail,
      });

      if (error) {
        console.error("Generate link error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to authenticate" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use the token_hash to verify and get session
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: data.properties.hashed_token,
        type: "magiclink",
      });

      if (verifyError) {
        console.error("Verify error:", verifyError);
        return new Response(
          JSON.stringify({ error: "Failed to create session" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      session = verifyData.session;
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        phone,
        email: phoneEmail,
        password: tempPassword,
        phone_confirm: true,
        email_confirm: true,
        user_metadata: { phone_login: true },
      });

      if (createError) {
        console.error("Create user error:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create account" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate session for new user
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: phoneEmail,
      });

      if (linkError) {
        console.error("Link error:", linkError);
        return new Response(
          JSON.stringify({ error: "Failed to authenticate new user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: "magiclink",
      });

      if (verifyError) {
        console.error("Verify new user error:", verifyError);
        return new Response(
          JSON.stringify({ error: "Failed to create session" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      session = verifyData.session;
    }

    // Clean up used OTPs
    await supabase.from("phone_otps").delete().eq("phone", phone);

    return new Response(
      JSON.stringify({ success: true, session }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("verify-otp error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
