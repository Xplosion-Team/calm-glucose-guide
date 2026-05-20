// Curated, safety-reviewed knowledge prompts shown after a game round.
// No clinical thresholds, no medication advice. Every explanation ends with
// a soft reminder to lean on the user's care team.

export interface GlucoseQuestion {
  id: string;
  q: string;
  options: string[];
  answerIndex: number;
  explain: string;
}

export const GLUCOSE_QUESTIONS: GlucoseQuestion[] = [
  {
    id: "walk",
    q: "A gentle 10-minute walk after a meal usually…",
    options: [
      "Spikes glucose higher",
      "Helps soften the post-meal rise",
      "Has no effect",
      "Should be avoided",
    ],
    answerIndex: 1,
    explain:
      "Light movement after eating helps your muscles use glucose, easing the post-meal rise. Your care team knows you best.",
  },
  {
    id: "water",
    q: "Staying well hydrated with water tends to…",
    options: [
      "Make glucose harder to manage",
      "Help your body manage glucose steadily",
      "Replace the need for medication",
      "Have no effect at all",
    ],
    answerIndex: 1,
    explain:
      "Good hydration supports the kidneys and helps your body regulate glucose. Your care team knows you best.",
  },
  {
    id: "fiber",
    q: "Foods rich in fiber (like beans, oats, vegetables) often…",
    options: [
      "Cause the sharpest spikes",
      "Lead to a gentler, slower rise",
      "Have no influence on glucose",
      "Are unsafe to eat",
    ],
    answerIndex: 1,
    explain:
      "Fiber slows how quickly sugar enters your bloodstream, so the rise is usually gentler. Your care team knows you best.",
  },
  {
    id: "sleep",
    q: "A restful night of sleep can…",
    options: [
      "Make the next day harder to manage",
      "Make glucose easier to manage the next day",
      "Have no effect",
      "Replace exercise",
    ],
    answerIndex: 1,
    explain:
      "Restorative sleep lowers stress hormones that nudge glucose up. Your care team knows you best.",
  },
  {
    id: "nuts",
    q: "Which snack tends to nudge glucose only gently?",
    options: [
      "A handful of almonds",
      "A glass of fruit juice",
      "White bread with jam",
      "A sugary soda",
    ],
    answerIndex: 0,
    explain:
      "Nuts are mostly fat, protein and a little fiber, so they raise glucose softly. Your care team knows you best.",
  },
  {
    id: "lows",
    q: "Which can be a sign of a low?",
    options: [
      "Feeling shaky, sweaty or suddenly very hungry",
      "Sharper eyesight",
      "Warm, dry skin",
      "A slower heartbeat",
    ],
    answerIndex: 0,
    explain:
      "Shakiness, sweating or sudden hunger can all be early signs. When in doubt, check and tell someone you trust.",
  },
  {
    id: "stress",
    q: "Stress and worry can…",
    options: [
      "Always lower glucose",
      "Sometimes nudge glucose up",
      "Have no effect on glucose",
      "Replace the need for sleep",
    ],
    answerIndex: 1,
    explain:
      "Stress hormones can quietly push glucose up. A calm breath, a friend, a short walk all help. Your care team knows you best.",
  },
  {
    id: "company",
    q: "Eating with company often…",
    options: [
      "Makes us eat faster",
      "Helps us slow down and notice fullness",
      "Has no effect on how we eat",
      "Always means larger portions",
    ],
    answerIndex: 1,
    explain:
      "Sharing a meal usually slows us down, which helps both digestion and steadier glucose. Your care team knows you best.",
  },
];

export function pickRandomQuestion(excludeIds: string[] = []): GlucoseQuestion {
  const pool = GLUCOSE_QUESTIONS.filter((q) => !excludeIds.includes(q.id));
  const source = pool.length > 0 ? pool : GLUCOSE_QUESTIONS;
  return source[Math.floor(Math.random() * source.length)];
}
