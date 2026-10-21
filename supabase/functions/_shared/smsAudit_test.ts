import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { careMirrorRole } from "./smsAudit.ts";

const uid = "fbdda4da-81e3-4b31-9814-762390307db9";

Deno.test("member's inbound text mirrors as sms_in", () => {
  assertEquals(careMirrorRole({ userId: uid, direction: "inbound" }), "sms_in");
});

Deno.test("outbound text to a member mirrors as sms_out", () => {
  assertEquals(careMirrorRole({ userId: uid, direction: "outbound" }), "sms_out");
});

Deno.test("texts with no linked member are never mirrored", () => {
  assertEquals(careMirrorRole({ direction: "inbound" }), null);
  assertEquals(careMirrorRole({ userId: null, direction: "outbound" }), null);
});

Deno.test("staff chat sends (skip_mirror) are not duplicated in the chat", () => {
  assertEquals(
    careMirrorRole({ userId: uid, direction: "outbound", metadata: { skip_mirror: true } }),
    null,
  );
});
