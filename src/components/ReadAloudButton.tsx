import { useCallback, useState } from "react";
import { Volume2, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useSpeech } from "@/hooks/useSpeech";
import { useToast } from "@/hooks/use-toast";
import { getScreenContext } from "@/lib/screen-context";
import type { SpeechMode } from "@/lib/screen-context";
import { supabase } from "@/integrations/supabase/client";

const MODE_STORAGE_KEY = "greens.readAloud.mode";

function loadMode(): SpeechMode {
  try {
    const v = localStorage.getItem(MODE_STORAGE_KEY) as SpeechMode | null;
    if (v === "brief" || v === "standard" || v === "detailed") return v;
  } catch { /* ignore */ }
  return "standard";
}

/**
 * Reads a short, AI-summarized version of the current screen aloud.
 * Pipeline: structured context (per-screen) → edge function (Lovable AI)
 * → speech-optimized script → speechSynthesis.
 * Falls back to a hand-written summary if the LLM call fails.
 */
export function ReadAloudButton() {
  const { isSupported, isSpeaking, speak, stop } = useSpeech();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<SpeechMode>(loadMode);

  const handleClick = useCallback(async () => {
    if (!isSupported) {
      toast({
        title: "Voice not available",
        description: "Your browser doesn't support read-aloud. Try Chrome or Safari.",
      });
      return;
    }

    // Toggle off
    if (isSpeaking || isLoading) {
      stop();
      setIsLoading(false);
      return;
    }

    const ctx = getScreenContext();
    if (!ctx) {
      toast({ title: "Nothing to read on this page yet." });
      return;
    }

    setIsLoading(true);
    let script = "";
    try {
      const { data, error } = await supabase.functions.invoke("speak-screen", {
        body: {
          screen: ctx.screen,
          status: ctx.status,
          highlights: ctx.highlights ?? [],
          data: ctx.data ?? {},
          mode,
        },
      });
      if (error) throw error;
      script = (data as { script?: string })?.script?.trim() ?? "";
    } catch (e) {
      console.warn("speak-screen failed, using fallback:", e);
    }

    if (!script) script = ctx.fallback;
    setIsLoading(false);
    speak(script);
  }, [isSupported, isSpeaking, isLoading, mode, speak, stop, toast]);

  const handleModeChange = (next: string) => {
    const m = next as SpeechMode;
    setMode(m);
    try { localStorage.setItem(MODE_STORAGE_KEY, m); } catch { /* ignore */ }
  };

  if (!isSupported) return null;

  return (
    <div className="flex items-center" data-no-read>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        aria-pressed={isSpeaking}
        aria-label={
          isLoading
            ? "Preparing summary"
            : isSpeaking
            ? "Stop reading"
            : "Read this page aloud"
        }
        title={isSpeaking ? "Stop reading" : "Read this page aloud"}
        className="w-12 h-12 rounded-full hover:bg-secondary"
      >
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        ) : isSpeaking ? (
          <Square className="w-5 h-5 text-primary fill-primary" />
        ) : (
          <Volume2 className="w-6 h-6" />
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Read-aloud settings"
            className="text-[10px] font-medium text-muted-foreground -ml-1 px-1.5 py-0.5 rounded hover:bg-secondary uppercase tracking-wide"
          >
            {mode === "brief" ? "Brief" : mode === "detailed" ? "Detail" : "Std"}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Read-aloud length</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={mode} onValueChange={handleModeChange}>
            <DropdownMenuRadioItem value="brief">Brief — one takeaway</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="standard">Standard — key highlights</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="detailed">Detailed — fuller summary</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
