// Nightscout: validate a Nightscout site URL + credentials.
// Isolated edge function — does not touch any existing pipeline.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeBaseUrl(url: string): string | null {
  try {
    let raw = url.trim();
    if (!raw) return null;
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // If user typed just a bare name like "mirna-elizondo01", assume Nightscout on fly.dev/herokuapp is unknown — leave host as-is and let the fetch fail with a clearer error.
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const rawUrl = typeof body.base_url === "string" ? body.base_url : "";
    const apiSecret = typeof body.api_secret === "string" ? body.api_secret : "";
    const accessToken = typeof body.access_token === "string" ? body.access_token : "";

    const baseUrl = normalizeBaseUrl(rawUrl);
    if (!baseUrl) {
      return new Response(JSON.stringify({ error: "Invalid Nightscout URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!apiSecret && !accessToken) {
      return new Response(
        JSON.stringify({ error: "Provide an API secret or an access token." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const headers: Record<string, string> = { accept: "application/json" };
    let testUrl = `${baseUrl}/api/v1/entries.json?count=1`;
    if (accessToken) {
      testUrl += `&token=${encodeURIComponent(accessToken)}`;
    } else if (apiSecret) {
      headers["api-secret"] = await sha1Hex(apiSecret);
    }

    const res = await fetch(testUrl, { headers });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Nightscout responded ${res.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const entries = await res.json();
    const latest = Array.isArray(entries) && entries.length > 0 ? entries[0] : null;

    return new Response(
      JSON.stringify({
        ok: true,
        base_url: baseUrl,
        latest_mg_dl: latest?.sgv ?? null,
        latest_at: latest?.date ? new Date(latest.date).toISOString() : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
