// Pure helpers for the inbound SMS flow. Kept free of network/Deno.serve so
// they can be unit tested directly.

export type EntryType = "food" | "drink" | "medication";

// Numbers are stored inconsistently (E.164, bare 10 digits, 1-prefixed), so we
// look the person up by every reasonable spelling of the number that texted us.
export function phoneVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return Array.from(new Set([raw, digits, ten, `1${ten}`, `+1${ten}`, `+${digits}`]));
}

export function classify(text: string): EntryType {
  const t = text.toLowerCase();
  if (/\b(pill|dose|metformin|insulin|med|medication|took my)\b/.test(t)) return "medication";
  if (/\b(coffee|tea|soda|juice|water|smoothie|milk|beer|wine|drank|drink|latte|shake)\b/.test(t)) {
    return "drink";
  }
  return "food";
}

export type ReplyIntent = "stop" | "confirm" | "discard" | "correction";

export function interpretReply(body: string): ReplyIntent {
  const text = body.trim();
  if (/^(stop|unsubscribe|cancel)$/i.test(text)) return "stop";
  if (/^(yes|y|yeah|yep|ok|okay|correct|confirm|save)\b/i.test(text)) return "confirm";
  if (/^(no|n|nope|discard|delete|nevermind|never mind)\b/i.test(text)) return "discard";
  return "correction";
}

// Ask the person to check the entry before anything is written to their journal.
export function confirmPrompt(label: string, carbs: number | null, portion: string | null) {
  const details = [carbs ? `~${carbs}g carbs` : null, portion ? `${portion} portion` : null]
    .filter(Boolean)
    .join(", ");
  return `Got it: ${label}${details ? ` (${details})` : ""}.\nReply YES to save, NO to discard, or just text me the correction.`;
}

// Warm confirmation sent back after the entry is written to the journal.
export function savedReplyText(
  entry: { type: string; label: string; carbs_grams: number | null; portion_size: string | null },
  dayCarbs: number,
) {
  if (entry.type === "medication") {
    return `Saved: ${entry.label}. Thanks for keeping up with it 💚`;
  }

  const details = [
    entry.carbs_grams ? `~${entry.carbs_grams}g carbs` : null,
    entry.portion_size ? `${entry.portion_size} portion` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const lines = [`Saved: ${entry.label}${details ? ` (${details})` : ""}.`];
  if (dayCarbs > 0) lines.push(`That's about ${dayCarbs}g of carbs logged today.`);
  lines.push("Thanks for sharing 💚 I'll check in with you a little later.");

  return lines.join("\n");
}

export function sumCarbs(rows: Array<{ carbs_grams: number | null }> | null | undefined) {
  return (rows ?? []).reduce((sum, r) => sum + (r.carbs_grams ?? 0), 0);
}
