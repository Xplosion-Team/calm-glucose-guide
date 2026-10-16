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

export const APP_LINK = "https://calmglucose.com";
export const readingsLinkText = () => `Here are your latest readings and meals: ${APP_LINK}`;

export type ReplyIntent = "readings" | "stop" | "confirm" | "discard" | "correction" | "new_entry" | "checkin";

export function interpretReply(body: string): ReplyIntent {
  const text = body.trim();
  if (/^(stop|unsubscribe|cancel)$/i.test(text)) return "stop";
  if (/^(link|readings?|my readings|app|glucose|numbers?)[.!?]?$/i.test(text)) return "readings";
  if (/^(yes|y|yeah|yep|ok|okay|correct|confirm|save)(\s+please)?[.!]?$/i.test(text)) return "confirm";
  if (/^(no|n|nope|discard|delete|nevermind|never mind)[.!]?$/i.test(text)) return "discard";
  if (/^(edit|correction|correct to|actually|instead|it was|make that|change to)\b/i.test(text)) return "correction";
  if (/^(note:|check-in:|i feel\b|i am feeling\b|feeling\b)/i.test(text)) return "checkin";
  return "new_entry";
}

// Ask the person to check the entry before anything is written to their journal.
export function confirmPrompt(label: string, carbs: number | null, portion: string | null) {
  const details = [carbs ? `~${carbs}g carbs` : null, portion ? `${portion} portion` : null]
    .filter(Boolean)
    .join(", ");
  return `Got it: ${label}${details ? ` (${details})` : ""}.\nReply YES to save, NO to discard, or EDIT followed by a correction. A separate food text adds another meal.`;
}

// Warm confirmation sent back after the entry is written to the journal.
export function savedReplyText(
  entry: { type: string; label: string; carbs_grams: number | null; portion_size: string | null },
  dayCarbs: number,
) {
  if (entry.type === "medication") {
    return `Saved: ${entry.label}. Thanks for keeping up with it 💚\nSee your latest readings: ${APP_LINK}`;
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
  lines.push(`See your latest readings: ${APP_LINK}`);

  return lines.join("\n");
}

export function sumCarbs(rows: Array<{ carbs_grams: number | null }> | null | undefined) {
  return (rows ?? []).reduce((sum, r) => sum + (r.carbs_grams ?? 0), 0);
}

// ---- When was the meal eaten? -------------------------------------------
export type EatenSource = "stated" | "glucose_rise" | "meal_window" | "texted";
export interface EatenTime { at: Date; source: EatenSource }

const MEAL_WINDOWS: Record<string, [number, number]> = {
  breakfast: [6 * 60, 10 * 60 + 30],
  brunch: [9 * 60 + 30, 12 * 60],
  lunch: [11 * 60, 14 * 60 + 30],
  dinner: [17 * 60, 21 * 60],
  supper: [17 * 60, 21 * 60],
};

function localMinutes(now: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

// The most recent moment (today, or yesterday if still ahead) at a local clock time.
export function atLocalMinutes(target: number, now: Date, tz: string) {
  let diff = localMinutes(now, tz) - target;
  if (diff < 0) diff += 24 * 60;
  return new Date(now.getTime() - diff * 60000);
}

export function mealWindow(text: string): [number, number] | null {
  const m = text.toLowerCase().match(/\b(breakfast|brunch|lunch|dinner|supper)\b/);
  return m ? MEAL_WINDOWS[m[1]] : null;
}

// Times the member wrote: "2 hours ago", "at 12:30pm", "noon".
export function parseEatenTime(text: string, now: Date, tz: string): Date | null {
  const t = text.toLowerCase();
  let m = t.match(/\b(\d+(?:\.\d+)?|an?|half an)\s*(hours?|hrs?|minutes?|mins?)\s*ago\b/);
  if (m) {
    const n = m[1] === "half an" ? 0.5 : /^an?$/.test(m[1]) ? 1 : Number(m[1]);
    const mins = /^h/.test(m[2]) ? n * 60 : n;
    if (mins > 0 && mins <= 24 * 60) return new Date(now.getTime() - mins * 60000);
  }
  if (/\bnoon\b/.test(t)) return atLocalMinutes(12 * 60, now, tz);
  m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?=\s|$|[.,!])/);
  if (m) {
    let h = Number(m[1]) % 12;
    if (m[3].startsWith("p")) h += 12;
    const min = Number(m[2] ?? 0);
    if (Number(m[1]) <= 12 && min < 60) return atLocalMinutes(h * 60 + min, now, tz);
  }
  return null;
}

// A reply that is only a time ("1pm", "about 2 hours ago") sets the eating time.
export function isTimeReply(text: string, now: Date, tz: string) {
  if (!parseEatenTime(text, now, tz)) return false;
  const rest = text.toLowerCase()
    .replace(/\b(i|ate|it|was|at|around|about|approx(imately)?|ago|noon|today|eaten|half|an?|hours?|hrs?|minutes?|mins?|a\.?m\.?|p\.?m\.?)\b/g, "")
    .replace(/(\d)\s*[ap]\.?m\.?/g, "$1")
    .replace(/[\d:.,!~\s]/g, "");
  return rest.length === 0;
}

// Start of the most recent glucose rise (>= minRise mg/dL within 2h of a low point).
export function findGlucoseRise(
  readings: Array<{ ts: string; mg_dl: number }>,
  window?: { from: Date; to: Date },
  minRise = 30,
): Date | null {
  const pts = readings.map((r) => ({ t: new Date(r.ts).getTime(), v: r.mg_dl }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)).sort((a, b) => a.t - b.t);
  let best: number | null = null;
  for (let i = 0; i < pts.length; i++) {
    const trough = pts[i];
    if (window && (trough.t < window.from.getTime() || trough.t > window.to.getTime())) continue;
    if (i > 0 && pts[i - 1].v < trough.v && trough.t - pts[i - 1].t < 20 * 60000) continue; // not a low point
    const peak = pts.slice(i + 1).filter((p) => p.t - trough.t <= 2 * 3.6e6).reduce((mx, p) => Math.max(mx, p.v), -Infinity);
    if (peak - trough.v >= minRise) best = trough.t;
  }
  return best === null ? null : new Date(best);
}

export function formatLocalTime(at: Date, tz: string) {
  return at.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
}

export function eatenLine(e: EatenTime, tz: string) {
  const when = formatLocalTime(e.at, tz);
  if (e.source === "stated") return `Eaten at about ${when}. Wrong time? Reply with the time, like "1pm".`;
  if (e.source === "glucose_rise") return `Your glucose started rising around ${when}, so I'll use that as when you ate (an estimate). Wrong time? Reply with the time, like "1pm" or "2 hours ago".`;
  if (e.source === "meal_window") return `I'll use ${when} as a typical meal time. When did you eat this? Reply with the time, like "12:30pm".`;
  return `When did you eat this? Reply with the time, like "noon" or "2 hours ago" — or YES if you just ate.`;
}
