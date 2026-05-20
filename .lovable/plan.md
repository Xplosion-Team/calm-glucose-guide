# Add Games to Circles Tab

Add a Games section to the Circles tab where users can play simple games designed for seniors. After finishing a game, they're gently prompted with a short diabetes/glucose knowledge question to reinforce learning.

## Scope

- Games live **inside the Circles tab** (per request), as a new section below the existing "Recent love" feed.
- A `GamesTab` component already exists at `src/components/tabs/GamesTab.tsx` — review and reuse/refactor rather than duplicate.
- All UI follows senior-first rules: 18px+ text, large tap targets, sage palette, warm tone, no clinical jargon.

## Games to include (v1)

Pick 3 calm, low-cognitive-load games suitable for 65+:

1. **Solitaire (Klondike)** — single-player, familiar, relaxing.
2. **Memory Match** — flip pairs of cards; gentle difficulty.
3. **Word Search** — diabetes-friendly food and wellness words baked into the grid.

Spades is fun but requires 4 players / bots with bidding logic — too heavy for v1. Note it as "Coming soon" if the user wants it visible.

## Post-game learning prompt

When a game ends (win, loss, or "I'm done"):

- Show a soft modal: *"Nice round! Here's a quick thought to take with you."*
- One multiple-choice question from a curated pool (3–4 options, one correct).
- Topics: hydration, gentle movement after meals, fiber, sleep, what numbers generally mean — **never** dosing, thresholds, or anything that could read as medical advice (per Safety Boundaries memory).
- Show a warm explanation after they answer, correct or not. No score, no streak pressure.
- "Skip for now" always available.

Question bank lives in `src/lib/games/glucose-questions.ts` as a typed array. Easy to extend.

## UI structure

```text
CirclesTab
├── Hero
├── Trusted people (existing)
├── Recent love (existing)
└── Games & Learning (NEW)
    ├── Section header + short caption
    └── 3 game cards (icon, title, 1-line description, Play button)

GameModal (full-screen drawer on mobile, dialog on desktop)
├── Game surface
└── On finish → PostGameQuestion → Close
```

## Files

**New**
- `src/components/circles/GamesSection.tsx` — the section rendered inside CirclesTab.
- `src/components/circles/GameLauncher.tsx` — modal/drawer wrapper that hosts a game and chains the question on finish.
- `src/components/circles/PostGameQuestion.tsx` — question UI.
- `src/components/games/SolitaireGame.tsx`
- `src/components/games/MemoryMatchGame.tsx`
- `src/components/games/WordSearchGame.tsx`
- `src/lib/games/glucose-questions.ts` — question bank + helper to pick a random unseen one.
- `src/hooks/useGamePlayHistory.ts` — localStorage-backed: last played, questions seen, simple "rounds played" counter.

**Modified**
- `src/components/tabs/CirclesTab.tsx` — render `<GamesSection />` at the bottom, update `useScreenContext` highlights to mention games.
- `src/i18n/translations.ts` — add game titles, button labels, question prompt copy (EN + existing locales).
- `src/components/tabs/GamesTab.tsx` — if it duplicates this work, remove or refactor to re-export `GamesSection`.

No database, no edge functions, no backend changes. Pure frontend, localStorage only.

## Game implementation notes (technical)

- **Solitaire**: lightweight from-scratch implementation using existing card primitives; standard Klondike rules, drag-and-drop with `@dnd-kit/core` (already common in shadcn projects — confirm in package.json, otherwise tap-to-move fallback). Auto-complete button when win is forced.
- **Memory Match**: 4×4 grid of emoji pairs (fruit/garden theme to match sage aesthetic). Pure React state.
- **Word Search**: 10×10 grid generated at mount from a curated word list (`WALK`, `WATER`, `SLEEP`, `FIBER`, `GREENS`, `CALM`, etc.). Tap first and last letter to select a word.
- All games expose `onFinish(result: { outcome: "win" | "quit"; durationSec: number })` so `GameLauncher` can chain the question prompt uniformly.
- Accessibility: keyboard navigation, `aria-live` for game state changes, 18px+ text, focus trap inside modal.

## Safety guardrails on questions

- Curated bank only — no LLM generation, so we control every word.
- No numeric thresholds, no medication names, no "should/must" language.
- Every explanation ends with a soft reminder: *"Your care team knows you best."*
- Reviewed against the Safety Boundaries memory before shipping.

## Out of scope

- Multiplayer / Spades.
- Leaderboards, achievements, streaks.
- Saving game stats to the backend (localStorage is enough for v1).
- Tying questions to the user's actual glucose data.

## Open questions

1. Keep Games inside Circles, or also expose a shortcut from the bottom nav? (Plan assumes Circles-only.)
2. Should the question appear after **every** game, or only ~1 in 3 so it doesn't feel like homework?
3. Want Spades listed as "Coming soon" or hidden entirely for v1?
