// Unit tests for the inbound "text me my meal" flow, exercised against a test
// profile (Mirna). No network calls, no real texts sent.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classify,
  confirmPrompt,
  interpretReply,
  phoneVariants,
  savedReplyText,
  sumCarbs,
} from "./logic.ts";

// Test profile fixture — mirrors an enrolled trial user with a linked phone.
const MIRNA = {
  userId: "af99e478-19f5-4ed4-a383-a2ec82608d84",
  phoneE164: "+19562224449",
};

Deno.test("phone lookup matches the profile no matter how the number is stored", () => {
  const variants = phoneVariants(MIRNA.phoneE164);
  for (const stored of ["+19562224449", "19562224449", "9562224449"]) {
    assertEquals(variants.includes(stored), true, `missing variant ${stored}`);
  }
  // A number texted in with formatting resolves to the same set.
  assertEquals(phoneVariants("(956) 222-4449").includes("+19562224449"), true);
});

Deno.test("classifies texted-in entries as food, drink or medication", () => {
  assertEquals(classify("I had a turkey sandwich and an apple"), "food");
  assertEquals(classify("protein smoothie this morning"), "drink");
  assertEquals(classify("took my metformin"), "medication");
});

Deno.test("reply intents drive the confirmation state machine", () => {
  for (const yes of ["YES", "yes please", "y", "ok", "confirm"]) {
    assertEquals(interpretReply(yes), "confirm", yes);
  }
  for (const no of ["NO", "nope", "discard", "never mind"]) {
    assertEquals(interpretReply(no), "discard", no);
  }
  assertEquals(interpretReply("stop"), "stop");
  assertEquals(interpretReply("it was two slices of toast"), "correction");
  assertEquals(interpretReply("chicken salad"), "new_entry");
});

Deno.test("draft confirmation prompt shows the estimate before anything saves", () => {
  const prompt = confirmPrompt("Oatmeal with berries", 42, "medium");
  assertEquals(prompt.includes("~42g carbs"), true);
  assertEquals(prompt.includes("medium portion"), true);
  assertEquals(prompt.includes("Reply YES to save"), true);
});

Deno.test("saved reply reports the entry and the running carb total", () => {
  const entry = {
    type: "food",
    label: "Oatmeal with berries",
    carbs_grams: 42,
    portion_size: "medium",
  };
  const text = savedReplyText(entry, sumCarbs([{ carbs_grams: 30 }, { carbs_grams: 42 }]));
  assertEquals(text.includes("Saved: Oatmeal with berries"), true);
  assertEquals(text.includes("That's about 72g of carbs logged today."), true);

  const med = savedReplyText(
    { type: "medication", label: "Metformin", carbs_grams: null, portion_size: null },
    0,
  );
  assertEquals(med, "Saved: Metformin. Thanks for keeping up with it 💚");
});

// End-to-end state machine over the pending-draft table, using the same
// helpers the webhook uses: text in -> draft -> correction -> YES -> saved.
type Draft = {
  user_id: string;
  type: string;
  label: string;
  carbs_grams: number | null;
  portion_size: string | null;
  original_text: string;
  status: "pending" | "confirmed" | "discarded";
};

function makeInbox(analyze: (text: string) => { label: string; carbs: number | null; portion: string | null }) {
  const drafts: Draft[] = [];
  const foodLogs: Array<Record<string, unknown>> = [];

  function receive(userId: string, body: string) {
    const intent = interpretReply(body);
    const pending = drafts.find((d) => d.user_id === userId && d.status === "pending");

    if (pending && intent === "confirm") {
      pending.status = "confirmed";
      foodLogs.push({
        user_id: userId,
        type: pending.type,
        label: pending.label,
        carbs_grams: pending.carbs_grams,
        portion_size: pending.portion_size,
        source: "sms",
      });
      return savedReplyText(pending, sumCarbs(foodLogs as Array<{ carbs_grams: number | null }>));
    }
    if (pending && intent === "discard") {
      pending.status = "discarded";
      return "No problem — I didn't save it. Text me again whenever you're ready.";
    }

    const type = classify(body);
    const parsed = analyze(body);
    if (pending && intent === "correction") {
      pending.type = type;
      pending.label = parsed.label;
      pending.carbs_grams = parsed.carbs;
      pending.portion_size = parsed.portion;
      pending.original_text = body;
    } else {
      drafts.push({
        user_id: userId,
        type,
        label: parsed.label,
        carbs_grams: parsed.carbs,
        portion_size: parsed.portion,
        original_text: body,
        status: "pending",
      });
    }
    return confirmPrompt(parsed.label, parsed.carbs, parsed.portion);
  }

  return { receive, drafts, foodLogs };
}

const fakeAnalyze = (text: string) =>
  text.toLowerCase().includes("toast")
    ? { label: "Two slices of toast", carbs: 30, portion: "small" }
    : { label: "Turkey sandwich", carbs: 45, portion: "medium" };

Deno.test("text -> draft -> YES saves one journal entry", () => {
  const inbox = makeInbox(fakeAnalyze);

  const first = inbox.receive(MIRNA.userId, "I had a turkey sandwich for lunch");
  assertEquals(first.includes("Reply YES to save"), true);
  assertEquals(inbox.foodLogs.length, 0, "nothing saves before confirmation");
  assertEquals(inbox.drafts.length, 1);

  const saved = inbox.receive(MIRNA.userId, "yes");
  assertEquals(inbox.foodLogs.length, 1);
  assertEquals(inbox.foodLogs[0].label, "Turkey sandwich");
  assertEquals(inbox.foodLogs[0].source, "sms");
  assertEquals(saved.includes("That's about 45g of carbs logged today."), true);
  assertEquals(inbox.drafts[0].status, "confirmed");
});

Deno.test("a correction updates the held draft instead of creating a second one", () => {
  const inbox = makeInbox(fakeAnalyze);
  inbox.receive(MIRNA.userId, "turkey sandwich");
  inbox.receive(MIRNA.userId, "actually it was toast");

  assertEquals(inbox.drafts.length, 1);
  assertEquals(inbox.drafts[0].label, "Two slices of toast");
  assertEquals(inbox.drafts[0].carbs_grams, 30);

  inbox.receive(MIRNA.userId, "YES");
  assertEquals(inbox.foodLogs.length, 1);
  assertEquals(inbox.foodLogs[0].label, "Two slices of toast");
});

Deno.test("NO discards the draft and saves nothing", () => {
  const inbox = makeInbox(fakeAnalyze);
  inbox.receive(MIRNA.userId, "turkey sandwich");
  const out = inbox.receive(MIRNA.userId, "no");

  assertEquals(inbox.foodLogs.length, 0);
  assertEquals(inbox.drafts[0].status, "discarded");
  assertEquals(out.includes("didn't save it"), true);
});

Deno.test("multiple food messages preserve separate drafts and YES saves oldest first", () => {
  const inbox = makeInbox(fakeAnalyze);
  inbox.receive(MIRNA.userId, "turkey sandwich");
  inbox.receive(MIRNA.userId, "toast");
  assertEquals(inbox.drafts.length, 2);
  assertEquals(inbox.drafts.map(d => d.label), ["Turkey sandwich", "Two slices of toast"]);
  assertEquals(inbox.foodLogs.length, 0);
  inbox.receive(MIRNA.userId, "YES");
  assertEquals(inbox.foodLogs.map(d => d.label), ["Turkey sandwich"]);
  assertEquals(inbox.drafts[1].status, "pending");
  inbox.receive(MIRNA.userId, "YES");
  assertEquals(inbox.foodLogs.map(d => d.label), ["Turkey sandwich", "Two slices of toast"]);
});

Deno.test("discarding one meal preserves the next waiting meal", () => {
  const inbox = makeInbox(fakeAnalyze);
  inbox.receive(MIRNA.userId, "turkey sandwich");
  inbox.receive(MIRNA.userId, "toast");
  inbox.receive(MIRNA.userId, "NO");
  assertEquals(inbox.drafts.map(d => d.status), ["discarded", "pending"]);
  inbox.receive(MIRNA.userId, "YES");
  assertEquals(inbox.foodLogs.map(d => d.label), ["Two slices of toast"]);
});

Deno.test("food messages route as new meals rather than check-in notes or confirmations", () => {
  assertEquals(interpretReply("chicken salad"), "new_entry");
  assertEquals(interpretReply("yes I also had toast"), "new_entry");
  assertEquals(interpretReply("no sugar coffee"), "new_entry");
  assertEquals(interpretReply("I feel fine"), "checkin");
  assertEquals(interpretReply("EDIT two slices of toast"), "correction");
});

import { parseEatenTime, isTimeReply, findGlucoseRise, formatLocalTime } from "./logic.ts";
const NOW = new Date("2026-10-16T20:00:00Z"); // 3:00 PM Chicago
Deno.test("stated eating times", () => {
  assertEquals(formatLocalTime(parseEatenTime("salmon at 12:30pm", NOW, "America/Chicago")!, "America/Chicago"), "12:30 PM");
  assertEquals(parseEatenTime("pasta 2 hours ago", NOW, "America/Chicago")!.toISOString(), "2026-10-16T18:00:00.000Z");
  assertEquals(parseEatenTime("chicken salad", NOW, "America/Chicago"), null);
});
Deno.test("time-only replies", () => {
  assertEquals(isTimeReply("1pm", NOW, "America/Chicago"), true);
  assertEquals(isTimeReply("about 2 hours ago", NOW, "America/Chicago"), true);
  assertEquals(isTimeReply("rice and beans at 1pm", NOW, "America/Chicago"), false);
});
Deno.test("glucose rise marks meal start", () => {
  const r = [["17:00",110],["17:30",105],["17:45",100],["18:15",135],["18:45",160],["19:30",120]]
    .map(([t,v]) => ({ ts: `2026-10-16T${t}:00Z`, mg_dl: v as number }));
  assertEquals(findGlucoseRise(r)!.toISOString(), "2026-10-16T17:45:00.000Z");
  assertEquals(findGlucoseRise(r.map((x) => ({ ...x, mg_dl: 110 }))), null);
});

import { interpretReply as ir2, savedReplyText as srt2, readingsLinkText as rlt } from "./logic.ts";
Deno.test("LINK/READINGS texts get the app link; saved replies include it", () => {
  for (const t of ["link", "READINGS", "my readings", "app"]) assertEquals(ir2(t), "readings");
  assertEquals(ir2("salmon and rice"), "new_entry");
  assertEquals(rlt().includes("https://calmglucose.com"), true);
  assertEquals(srt2({ type: "food", label: "Salmon", carbs_grams: 40, portion_size: null }, 40).includes("https://calmglucose.com"), true);
});
