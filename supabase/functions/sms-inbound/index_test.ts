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
    const pending = [...drafts].reverse().find((d) => d.user_id === userId && d.status === "pending");

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
    if (pending) {
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
