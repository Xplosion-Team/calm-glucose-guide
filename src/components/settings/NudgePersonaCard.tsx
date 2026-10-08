import { useState } from "react";
import { MessageCircle, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNotificationPrefs, type PersonaType, type VoiceStyle } from "@/hooks/useNotificationPrefs";
import { formatInAppNudge } from "@/lib/nudge-persona";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "@/components/ui/use-toast";

const PERSONAS = ["Kevin Hart", "Snoop Dogg", "Morgan Freeman", "Ryan Reynolds", "Samuel L. Jackson", "Gordon Ramsay", "Terry Crews", "Sofia Vergara", "Dwayne Johnson"];

export function NudgePersonaCard() {
  const { prefs, save, loaded, saving } = useNotificationPrefs();
  const { lang } = useI18n();
  const [testing, setTesting] = useState(false);
  if (!loaded) return null;

  const es = lang === "es";
  const personaOptions: { value: PersonaType; label: string }[] = [
    { value: "standard", label: es ? "Guía estándar" : "Standard Guide" },
    { value: "comedian", label: es ? "Comediante" : "Comedian" },
    { value: "celebrity", label: es ? "Portavoz / celebridad" : "Spokesperson / Celebrity" },
    { value: "custom", label: es ? "Personalidad personalizada" : "Custom Persona" },
  ];
  const tones: { value: VoiceStyle; label: string }[] = [
    { value: "encouraging", label: es ? "Positivo y animado" : "Encouraging & Upbeat" },
    { value: "witty", label: es ? "Sarcástico e ingenioso" : "Sarcastic & Witty" },
    { value: "direct", label: es ? "Directo / firme" : "Direct / Tough Love" },
    { value: "calm", label: es ? "Tranquilo y consciente" : "Calm & Mindful" },
  ];
  const sample = formatInAppNudge("meal", prefs, es ? "comida" : "lunch");
  const showName = prefs.persona_type === "celebrity" || prefs.persona_type === "custom";

  const sendTest = async () => {
    setTesting(true);
    const { error } = await supabase.functions.invoke("send-test-sms", { body: {} });
    setTesting(false);
    toast({
      title: error ? (es ? "No se pudo enviar" : "Couldn’t send the text") : (es ? "Mensaje enviado" : "Test text sent"),
      description: error ? error.message : (es ? "Revisa el teléfono vinculado a tu cuenta." : "Check the phone linked to your account."),
      variant: error ? "destructive" : "default",
    });
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-6">
        <div className="flex items-start gap-3">
          <Sparkles className="w-6 h-6 text-primary mt-1" aria-hidden />
          <div><h2 className="text-xl font-semibold">{es ? "Personalidad y voz de recordatorios" : "Nudge Persona & Voice Settings"}</h2><p className="text-sm text-muted-foreground">{es ? "Elige cómo se sienten tus recordatorios." : "Choose how your reminders feel."}</p></div>
        </div>

        <div className="space-y-3">
          <Label className="text-base">{es ? "Personalidad" : "Persona"}</Label>
          <RadioGroup value={prefs.persona_type} onValueChange={(value) => void save({ persona_type: value as PersonaType, persona_name: value === "standard" || value === "comedian" ? null : prefs.persona_name })} className="grid gap-2">
            {personaOptions.map((option) => <Label key={option.value} className="min-h-14 border rounded-lg p-3 cursor-pointer flex items-center gap-3 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"><RadioGroupItem value={option.value} />{option.label}</Label>)}
          </RadioGroup>
        </div>

        {showName && <div className="space-y-3">
          {prefs.persona_type === "celebrity" && <div className="flex flex-wrap gap-2">{PERSONAS.map((name) => <Button key={name} type="button" variant={prefs.persona_name === name ? "default" : "outline"} size="sm" className="min-h-11" onClick={() => void save({ persona_name: name })}>{name}</Button>)}</div>}
          <Label htmlFor="persona-name">{es ? "O escribe tu personalidad favorita…" : "Or type your own favorite persona…"}</Label>
          <Input id="persona-name" value={prefs.persona_name ?? ""} maxLength={80} onChange={(event) => void save({ persona_name: event.target.value || null })} className="h-14 text-base" />
        </div>}

        <div className="space-y-3"><Label className="text-base">{es ? "Voz y tono" : "Voice & tone"}</Label><RadioGroup value={prefs.voice_style} onValueChange={(value) => void save({ voice_style: value as VoiceStyle })} className="grid gap-2">{tones.map((tone) => <Label key={tone.value} className="min-h-14 border rounded-lg p-3 cursor-pointer flex items-center gap-3 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"><RadioGroupItem value={tone.value} />{tone.label}</Label>)}</RadioGroup></div>

        <div className="rounded-lg bg-secondary/60 p-4 space-y-1" aria-live="polite"><div className="flex gap-2 items-center text-sm font-semibold"><MessageCircle className="w-4 h-4" />{es ? "Vista previa" : "Preview"}</div><p className="font-medium">{sample.title}</p><p className="text-sm text-muted-foreground">{sample.body}</p></div>

        <Button className="w-full min-h-14 text-base gap-2" onClick={() => void sendTest()} disabled={testing || saving || (showName && !prefs.persona_name?.trim())}><Send className="w-5 h-5" />{testing ? (es ? "Enviando…" : "Sending…") : (es ? "Enviar mensaje de prueba" : "Send Test SMS Nudge")}</Button>
      </CardContent>
    </Card>
  );
}