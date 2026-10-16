// Pure helpers for "rise with no meal logged" texts. Same matching rules as
// src/lib/meal-glucose.ts in the app, so cards and texts agree.

export interface Reading { t: number; v: number }
export interface Rise { start: number; startValue: number; peak: number; peakAt: number }

const MIN = 60000;
export const MIN_RISE = 15;           // mg/dL within 2 h of a low point
export const WAIT_MIN = 30;           // wait after rise start before texting
export const REALTIME_MAX_MIN = 180;  // older rises go into the evening summary
export const DAILY_CAP = 3;
export const SPACING_MIN = 120;
export const DIGEST_HOUR = 19;

// A meal from 90 min before to 60 min after the rise start explains it.
export function mealCovers(mealAt: number, riseStart: number) {
  return mealAt >= riseStart - 90 * MIN && mealAt <= riseStart + 60 * MIN;
}

export function detectRises(readings: Reading[], mealTimes: number[], minRise = MIN_RISE): Rise[] {
  const pts = [...readings].sort((a, b) => a.t - b.t);
  const out: Rise[] = [];
  let i = 0;
  while (i < pts.length) {
    const trough = pts[i];
    const win = pts.filter((p) => p.t > trough.t && p.t - trough.t <= 120 * MIN);
    const top = win.reduce<Reading | null>((a, b) => (!a || b.v > a.v ? b : a), null);
    const lower = top && win.find((p) => p.t < top.t && p.v < trough.v);
    if (top && !lower && top.v - trough.v >= minRise) {
      if (!mealTimes.some((m) => mealCovers(m, trough.t))) {
        out.push({ start: trough.t, startValue: trough.v, peak: top.v, peakAt: top.t });
      }
      i = pts.findIndex((p) => p.t > top.t + 60 * MIN);
      if (i < 0) break;
      continue;
    }
    i++;
  }
  return out;
}

export interface QueuedRise { id: string; start: number }

// Decide what to text now. Real-time: 30 min to 3 h after rise start, one at a
// time, capped per day with spacing. Older ones are marked for the summary.
export function planRiseTexts(opts: {
  queued: QueuedRise[]; now: number; sentToday: number[]; quiet: boolean; draftWaiting: boolean;
}) {
  const { queued, now, sentToday, quiet, draftWaiting } = opts;
  const toDigest = queued.filter((q) => now - q.start > REALTIME_MAX_MIN * MIN).map((q) => q.id);
  const ready = queued
    .filter((q) => now - q.start >= WAIT_MIN * MIN && now - q.start <= REALTIME_MAX_MIN * MIN)
    .sort((a, b) => b.start - a.start);
  const lastSent = sentToday.length ? Math.max(...sentToday) : null;
  const blocked = quiet || draftWaiting || sentToday.length >= DAILY_CAP ||
    (lastSent !== null && now - lastSent < SPACING_MIN * MIN);
  return { sendNow: blocked || !ready.length ? null : ready[0].id, toDigest };
}

// "12:40 salmon and rice" → nearest rise within 90 min of 12:40, plus the food text.
export function matchTimedReply(text: string, rises: QueuedRise[], toInstant: (minutes: number) => number) {
  const m = text.trim().match(/^(?:at\s+|around\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*[-,:]?\s+(.+)$/i);
  if (!m || !rises.length) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  const ap = m[3]?.toLowerCase();
  const candidates = ap
    ? [((h % 12) + (ap.startsWith("p") ? 12 : 0)) * 60 + min]
    : h <= 12 ? [(h % 12) * 60 + min, ((h % 12) + 12) * 60 + min] : [h * 60 + min];
  let best: { id: string; dist: number; at: number } | null = null;
  for (const c of candidates) {
    const at = toInstant(c);
    for (const r of rises) {
      const dist = Math.abs(r.start - at);
      if (dist <= 90 * MIN && (!best || dist < best.dist)) best = { id: r.id, dist, at: r.start };
    }
  }
  return best ? { riseId: best.id, riseStart: best.at, food: m[4].trim() } : null;
}

export function isNoMealReply(text: string) {
  return /^(no|nope|nothing|didn'?t eat|did not eat|no food|nada)[.!]?$/i.test(text.trim());
}
