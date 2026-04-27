import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lightweight wrapper around the browser SpeechSynthesis API.
 * - No API key, works offline.
 * - Picks a natural English voice when available.
 * - Tracks speaking state so the UI can toggle play/stop.
 */
export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setIsSupported(true);

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      // Prefer a natural-sounding English voice
      voiceRef.current =
        voices.find((v) => /en(-|_)?(US|GB)/i.test(v.lang) && /natural|google|samantha|female/i.test(v.name)) ||
        voices.find((v) => /^en/i.test(v.lang)) ||
        voices[0];
    };
    pickVoice();
    window.speechSynthesis.addEventListener("voiceschanged", pickVoice);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", pickVoice);
      window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) utter.voice = voiceRef.current;
      utter.rate = 0.95; // a touch slower for clarity
      utter.pitch = 1;
      utter.volume = 1;
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utter);
    },
    [isSupported]
  );

  const toggle = useCallback(
    (text: string) => {
      if (isSpeaking) stop();
      else speak(text);
    },
    [isSpeaking, speak, stop]
  );

  return { isSupported, isSpeaking, speak, stop, toggle };
}

/**
 * Extracts visible, readable text from a DOM element.
 * Skips hidden elements, scripts, and the read-aloud control itself.
 */
export function extractReadableText(root: HTMLElement | null): string {
  if (!root) return "";
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(
    "[data-no-read], script, style, noscript, [aria-hidden='true']"
  ).forEach((el) => el.remove());
  // Collapse whitespace
  return clone.innerText.replace(/\s+/g, " ").trim();
}
