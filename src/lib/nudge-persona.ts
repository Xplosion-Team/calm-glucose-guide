import type { NotificationPrefs } from "@/hooks/useNotificationPrefs";

type NudgeKind = "meal" | "spike";

export function formatInAppNudge(
  kind: NudgeKind,
  prefs: Pick<NotificationPrefs, "persona_type" | "persona_name" | "voice_style">,
  mealLabel?: string,
) {
  const subject = mealLabel || "meal";
  const persona = prefs.persona_name?.trim();
  const lead = prefs.persona_type === "comedian"
    ? "Quick, friendly check-in"
    : persona
      ? `${persona}-inspired check-in`
      : prefs.voice_style === "direct"
        ? "A quick check-in"
        : prefs.voice_style === "encouraging"
          ? "You’re doing a great job keeping track"
          : prefs.voice_style === "witty"
            ? "Your journal called—it wants the latest"
            : "A gentle check-in";

  if (kind === "spike") {
    return {
      title: lead,
      body: "We noticed a change in your glucose. Did you recently eat or drink?",
    };
  }

  return {
    title: `${lead} about your ${subject}`,
    body: prefs.voice_style === "direct"
      ? "Add a quick note about how you feel so your journal stays useful."
      : "When you’re ready, add a quick note about how you feel.",
  };
}