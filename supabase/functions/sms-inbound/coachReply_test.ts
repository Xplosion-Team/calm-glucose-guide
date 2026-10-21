import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { COACH_REPLY_WINDOW_MS, interpretReply, mealCommand, routeCoachReply, type CoachReplyContext } from "./logic.ts";

const now = Date.parse("2026-10-21T18:21:00Z");
const context: CoachReplyContext = {
  now, coachSentAt: now - 60000, mealQuestionAt: now - 120000,
  hasPending: true, hasPhoto: false,
};

Deno.test("coach replies cannot confirm or discard an older waiting meal", () => {
  for (const reply of ["ok", "yes", "no", "sounds good, see you Tuesday", "I feel fine", "actually see you Wednesday"]) {
    assertEquals(routeCoachReply(reply, context), "coach", reply);
  }
});

Deno.test("coach protection lasts 30 minutes", () => {
  assertEquals(COACH_REPLY_WINDOW_MS, 30 * 60 * 1000);
  assertEquals(routeCoachReply("ok", { ...context, coachSentAt: now - COACH_REPLY_WINDOW_MS + 1 }), "coach");
  assertEquals(routeCoachReply("ok", { ...context, coachSentAt: now - COACH_REPLY_WINDOW_MS }), "logger");
});

Deno.test("YES and NO can answer a meal question sent after the coach", () => {
  const latestMeal = { ...context, mealQuestionAt: now - 30000 };
  for (const reply of ["YES", "NO", "EDIT two slices of toast"]) assertEquals(routeCoachReply(reply, latestMeal), "logger");
  assertEquals(routeCoachReply("1pm", { ...latestMeal, isPendingTimeReply: true }), "logger");
  assertEquals(routeCoachReply("sounds good, see you Tuesday", latestMeal), "coach");
});

Deno.test("clear food and meal photos create drafts during coach conversations", () => {
  for (const reply of ["salmon and rice", "salmon mash potatoes and macaronni", "I ate couscous", "protein drink and donuts"]) {
    assertEquals(routeCoachReply(reply, context), "logger", reply);
    assertEquals(interpretReply(reply), "new_entry");
  }
  assertEquals(routeCoachReply("", { ...context, hasPhoto: true }), "logger");
});

Deno.test("named logger and save this meal explicitly confirm only a waiting draft", () => {
  for (const reply of ["save this meal", "Mr. Calm, save this meal", "calmsugar save this meal", "calmglucose, save this meal"]) {
    assertEquals(routeCoachReply(reply, context), "logger", reply);
    assertEquals(interpretReply(reply), "confirm", reply);
  }
  assertEquals(mealCommand("Mr. Calm, save this meal: salmon and rice").text, "salmon and rice");
  assertEquals(interpretReply("Mr. Calm, save this meal: salmon and rice"), "new_entry", "New details require a draft, not immediate saving");
  assertEquals(mealCommand("CalmGlucose, quinoa with kale").text, "quinoa with kale");
  assertEquals(routeCoachReply("CalmGlucose, quinoa with kale", context), "logger");
});

Deno.test("coach NO cannot dismiss an earlier rise; newer rise question can", () => {
  assertEquals(routeCoachReply("NO", { ...context, hasPending: false }), "coach");
  assertEquals(routeCoachReply("NO", { ...context, hasPending: false, mealQuestionAt: now - 30000 }), "logger");
});

Deno.test("opt out and readings stay available during coach protection", () => {
  assertEquals(routeCoachReply("STOP", context), "logger");
  assertEquals(routeCoachReply("READINGS", context), "logger");
});

Deno.test("audit lookup failure keeps ambiguous replies out of meal mutations", () => {
  assertEquals(routeCoachReply("YES", { ...context, lookupFailed: true, mealQuestionAt: now }), "coach");
  assertEquals(routeCoachReply("salmon and rice", { ...context, lookupFailed: true }), "logger");
});