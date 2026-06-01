// T1Pal: validate a T1Pal site URL + optional token.
// Isolated edge function — does not touch any existing pipeline.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// SSRF protection: only allow public hostnames.
function isUnsafeHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0" || h === "::1") return true;
  // crude IPv4 private/loopback/link-local check
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    if (a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

function normalizeBaseUrl(url: string): string | null {
  try {
    let raw = url.trim();
    if (!raw) return null;
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    if (isUnsafeHost(u.hostname)) return null;
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
    const baseUrl = normalizeBaseUrl(typeof body.t1pal_url === "string" ? body.t1pal_url : "");
    const accessToken = typeof body.access_token === "string" ? body.access_token : "";

    if (!baseUrl) {
      return new Response(
        JSON.stringify({ error: "Please enter your T1Pal URL (e.g. https://yourname.t1pal.com)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let testUrl = `${baseUrl}/api/v1/entries.json?count=1`;
    if (accessToken) testUrl += `&token=${encodeURIComponent(accessToken)}`;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(testUrl, { headers: { accept: "application/json" }, signal: controller.signal }).finally(() => clearTimeout(t));

    if (!res.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `T1Pal responded ${res.status}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const entries = await res.json().catch(() => null);
    if (!Array.isArray(entries)) {
      return new Response(JSON.stringify({ ok: false, error: "Unexpected response from T1Pal" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const latest = entries[0] ?? null;
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
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
