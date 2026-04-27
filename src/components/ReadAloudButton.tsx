import { useCallback } from "react";
import { Volume2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeech, extractReadableText } from "@/hooks/useSpeech";
import { useToast } from "@/hooks/use-toast";

interface ReadAloudButtonProps {
  /** CSS selector for the region to read. Defaults to <main> or the page container. */
  targetSelector?: string;
}

/**
 * A small accessible button that reads the current page content aloud
 * using the browser's built-in speech synthesis. No API key required.
 */
export function ReadAloudButton({ targetSelector = "[data-readable-page]" }: ReadAloudButtonProps) {
  const { isSupported, isSpeaking, speak, stop } = useSpeech();
  const { toast } = useToast();

  const handleClick = useCallback(() => {
    if (!isSupported) {
      toast({
        title: "Voice not available",
        description: "Your browser doesn't support read-aloud. Try Chrome or Safari.",
      });
      return;
    }
    if (isSpeaking) {
      stop();
      return;
    }
    const target = document.querySelector(targetSelector) as HTMLElement | null;
    const text = extractReadableText(target);
    if (!text) {
      toast({ title: "Nothing to read on this page yet." });
      return;
    }
    speak(text);
  }, [isSupported, isSpeaking, speak, stop, targetSelector, toast]);

  if (!isSupported) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      data-no-read
      aria-pressed={isSpeaking}
      aria-label={isSpeaking ? "Stop reading" : "Read this page aloud"}
      title={isSpeaking ? "Stop reading" : "Read this page aloud"}
      className="w-12 h-12 rounded-full hover:bg-secondary"
    >
      {isSpeaking ? (
        <Square className="w-6 h-6 text-primary fill-primary" />
      ) : (
        <Volume2 className="w-6 h-6" />
      )}
    </Button>
  );
}
