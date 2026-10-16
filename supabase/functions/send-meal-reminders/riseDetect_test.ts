import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { detectRises, planRiseTexts, matchTimedReply, isNoMealReply } from "../_shared/riseDetect.ts";

const T0 = Date.parse("2026-10-16T17:00:00Z");
const M = 60000;
const r = (min: number, v: number) => ({ t: T0 + min * M, v });
const lunch = [r(-30, 112), r(0, 110), r(15, 115), r(30, 122), r(45, 128), r(60, 120), r(90, 112)];

Deno.test("a 20+ rise with no meal is detected; under 20 is not", () => {
  assertEquals(detectRises(lunch, []).length, 1);
  assertEquals(detectRises(lunch, [])[0].start, T0);
  assertEquals(detectRises(lunch.map((p) => ({ ...p, v: Math.min(p.v, 125) })), []).length, 0);
});

Deno.test("a meal from 90 min before to 60 min after explains the rise", () => {
  assertEquals(detectRises(lunch, [T0 - 80 * M]).length, 0);
  assertEquals(detectRises(lunch, [T0 + 50 * M]).length, 0);
  assertEquals(detectRises(lunch, [T0 + 70 * M]).length, 1);
});

Deno.test("waits 30 minutes before texting", () => {
  const q = [{ id: "a", start: T0 }];
  assertEquals(planRiseTexts({ queued: q, now: T0 + 20 * M, sentToday: [], quiet: false, draftWaiting: false }).sendNow, null);
  assertEquals(planRiseTexts({ queued: q, now: T0 + 35 * M, sentToday: [], quiet: false, draftWaiting: false }).sendNow, "a");
});

Deno.test("max 3 a day, 2 hours apart, quiet hours and waiting drafts block", () => {
  const q = [{ id: "a", start: T0 }];
  const now = T0 + 40 * M;
  const base = { queued: q, now, quiet: false, draftWaiting: false };
  assertEquals(planRiseTexts({ ...base, sentToday: [now - 5 * 3.6e6, now - 4 * 3.6e6, now - 3 * 3.6e6] }).sendNow, null);
  assertEquals(planRiseTexts({ ...base, sentToday: [now - 60 * M] }).sendNow, null);
  assertEquals(planRiseTexts({ ...base, sentToday: [now - 130 * M] }).sendNow, "a");
  assertEquals(planRiseTexts({ ...base, sentToday: [], quiet: true }).sendNow, null);
  assertEquals(planRiseTexts({ ...base, sentToday: [], draftWaiting: true }).sendNow, null);
});

Deno.test("rises older than 3 hours go to the evening summary", () => {
  const p = planRiseTexts({ queued: [{ id: "old", start: T0 }], now: T0 + 4 * 3.6e6, sentToday: [], quiet: false, draftWaiting: false });
  assertEquals(p.sendNow, null);
  assertEquals(p.toDigest, ["old"]);
});

Deno.test("summary replies with a time match the nearest rise", () => {
  // toInstant: local minutes → instant, local = UTC-5
  const toInstant = (mins: number) => Date.parse("2026-10-16T05:00:00Z") + mins * M;
  const rises = [{ id: "lunch", start: Date.parse("2026-10-16T17:40:00Z") }, { id: "dinner", start: Date.parse("2026-10-16T22:10:00Z") }];
  assertEquals(matchTimedReply("12:40 salmon and rice", rises, toInstant)?.riseId, "lunch");
  assertEquals(matchTimedReply("5pm tacos", rises, toInstant)?.riseId, "dinner");
  assertEquals(matchTimedReply("salmon and rice", rises, toInstant), null);
  assertEquals(isNoMealReply("nothing"), true);
  assertEquals(isNoMealReply("noodles"), false);
});
