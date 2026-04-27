// Central registry of structured context for each screen.
// Pages publish their context here; ReadAloudButton consumes it.
// We deliberately keep this OUT of React state to avoid re-renders.

export type SpeechMode = "brief" | "standard" | "detailed";

export interface ScreenContext {
  /** Screen name as the user would say it: "Now", "Progress", "Twin", etc. */
  screen: string;
  /** One-line key takeaway / current status. */
  status: string;
  /** Up to ~5 highlights; the LLM will pick the most important. */
  highlights?: string[];
  /** Optional structured numbers/flags the LLM can reference. */
  data?: Record<string, unknown>;
  /** Hand-written fallback used if the LLM call fails. */
  fallback: string;
}

let current: ScreenContext | null = null;

export function setScreenContext(ctx: ScreenContext) {
  current = ctx;
}

export function clearScreenContext() {
  current = null;
}

export function getScreenContext(): ScreenContext | null {
  return current;
}
