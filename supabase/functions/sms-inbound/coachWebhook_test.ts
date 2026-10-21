// Exercise the actual webhook with mocked external services. No real texts,
// member data, or journal entries are created by these tests.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("webhook mirrors a coach YES without saving or discarding a waiting meal", async () => {
  const originalFetch = globalThis.fetch;
  const originalServe = Deno.serve;
  const envNames = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const previous = envNames.map((name) => Deno.env.get(name));
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const writes: Array<{ table: string; method: string; body: Record<string, unknown> }> = [];
  const userId = "00000000-0000-4000-8000-000000000001";
  const now = Date.now();
  Deno.env.set("SUPABASE_URL", "https://sms-routing-test.invalid");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key-not-a-real-credential");
  Deno.serve = ((callback: (req: Request) => Promise<Response>) => {
    handler = callback;
    return {};
  }) as unknown as typeof Deno.serve;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname !== "sms-routing-test.invalid") throw new Error("Unexpected external request");
    const table = url.pathname.split("/").pop() ?? "";
    const method = init?.method ?? "GET";
    if (method !== "GET") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      writes.push({ table, method, body });
      if (table === "find_user_by_phone") return Response.json(userId);
      if (table === "sms_events" && method === "POST") return Response.json([{ id: "test-inbound-event" }]);
      return Response.json([]);
    }
    if (table === "sms_pending_logs") return Response.json([{
      id: "test-pending-meal", type: "food", label: "Salmon and rice", carbs_grams: 40,
      portion_size: "medium", original_text: "salmon and rice", eaten_at: new Date(now).toISOString(), eaten_at_source: "stated",
    }]);
    if (table === "user_engagement") return Response.json([{ timezone: "America/Chicago" }]);
    if (table === "sms_events") return Response.json([
      { purpose: "care_chat", related_table: null, created_at: new Date(now - 60000).toISOString() },
      { purpose: "reply: new entry", related_table: "sms_pending_logs", created_at: new Date(now - 120000).toISOString() },
    ]);
    throw new Error(`Unexpected table read: ${table}`);
  }) as typeof fetch;
  try {
    await import("./index.ts");
    if (!handler) throw new Error("Webhook handler was not registered");
    const response = await handler(new Request("https://sms-routing-test.invalid/functions/v1/sms-inbound", {
      method: "POST", body: new URLSearchParams({ From: "+15555550100", Body: "YES" }),
    }));
    assertEquals(response.status, 200);
    assertEquals(await response.text(), '<?xml version="1.0" encoding="UTF-8"?><Response/>');
    assertEquals(writes.filter((w) => w.table === "food_logs" || w.table === "sms_pending_logs" || w.table === "spike_events").length, 0);
    assertEquals(writes.some((w) => w.table === "care_messages" && w.body.sender_role === "sms_in" && w.body.body === "YES"), true);
    assertEquals(writes.some((w) => w.table === "sms_events" && w.method === "PATCH" && w.body.purpose === "care_chat reply"), true);
    assertEquals(writes.filter((w) => w.table === "sms_events" && w.body.direction === "outbound").length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    Deno.serve = originalServe;
    envNames.forEach((name, index) => {
      const value = previous[index];
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    });
  }
});