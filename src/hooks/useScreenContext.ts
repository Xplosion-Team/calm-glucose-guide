import { useEffect } from "react";
import { setScreenContext, clearScreenContext, type ScreenContext } from "@/lib/screen-context";

/**
 * Publishes structured context for the current screen so the
 * Read Aloud button can ask the LLM to summarize it.
 *
 * Pass a stable object or memoize upstream — we re-publish on every change.
 */
export function useScreenContext(ctx: ScreenContext | null) {
  useEffect(() => {
    if (!ctx) {
      clearScreenContext();
      return;
    }
    setScreenContext(ctx);
    return () => {
      // Don't clear on unmount — the next screen will overwrite immediately.
      // Clearing here causes a brief window where context is missing.
    };
  }, [ctx]);
}
