import { useRef, useState } from "react";
import { Camera, Mic, Type, Loader2, Check, Square } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/hooks/use-toast";
import { PortionGuide } from "./PortionGuide";
import type { TranslationKey } from "@/i18n/translations";

type Mode = "photo" | "text" | "voice";

interface AIFoodResult {
  foodName: string;
  carbsGrams: number;
  portionSize: "small" | "medium" | "large";
  category: "meal" | "snack" | "drink";
}

export interface ConfirmedLog {
  type: "food" | "drink";
  label: string;
  carbsGrams: number;
  portionSize: "small" | "medium" | "large";
  source: "photo" | "text" | "voice";
}

interface Props {
  onConfirm: (log: ConfirmedLog) => void;
}

const PORTION_KEYS: Record<string, TranslationKey> = {
  small: "today.portionSmall",
  medium: "today.portionMedium",
  large: "today.portionLarge",
};

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1024;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8).split(",")[1]);
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function SmartLogCard({ onConfirm }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("photo");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string>("");
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);

  const [result, setResult] = useState<AIFoodResult | null>(null);
  const [editedLabel, setEditedLabel] = useState("");
  const [resultSource, setResultSource] = useState<"photo" | "text" | "voice">("photo");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const reset = () => {
    setResult(null);
    setEditedLabel("");
    setText("");
  };

  const callAnalyze = async (body: { imageBase64?: string; text?: string }, source: "photo" | "text" | "voice") => {
    setBusy(true);
    setBusyLabel(t("today.analyzing"));
    try {
      const { data, error } = await supabase.functions.invoke("analyze-food", {
        body: { ...body, lang },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const r = data as AIFoodResult;
      setResult(r);
      setEditedLabel(r.foodName);
      setResultSource(source);
    } catch (err: any) {
      console.error("analyze failed", err);
      toast({ title: t("today.photoError"), variant: "destructive" });
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const imageBase64 = await compressImage(file);
    await callAnalyze({ imageBase64 }, "photo");
  };

  const handleTextSubmit = async () => {
    if (!text.trim()) return;
    await callAnalyze({ text: text.trim() }, "text");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        await transcribeAndAnalyze(blob);
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      console.error("mic error", err);
      toast({ title: t("today.micError"), variant: "destructive" });
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const transcribeAndAnalyze = async (blob: Blob) => {
    setBusy(true);
    setBusyLabel(t("today.transcribing"));
    try {
      const audioBase64 = await blobToBase64(blob);
      const { data, error } = await supabase.functions.invoke("transcribe-audio", {
        body: { audioBase64, mimeType: blob.type, lang },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const transcript = (data?.transcript as string) || "";
      if (!transcript) throw new Error("Empty transcript");
      await callAnalyze({ text: transcript }, "voice");
    } catch (err) {
      console.error("transcribe failed", err);
      toast({ title: t("today.voiceError"), variant: "destructive" });
      setBusy(false);
      setBusyLabel("");
    }
  };

  const confirm = () => {
    if (!result) return;
    onConfirm({
      type: result.category === "drink" ? "drink" : "food",
      label: editedLabel.trim() || result.foodName,
      carbsGrams: result.carbsGrams,
      portionSize: result.portionSize,
      source: resultSource,
    });
    reset();
  };

  const modeBtn = (m: Mode, Icon: typeof Camera, labelKey: TranslationKey) => (
    <button
      key={m}
      type="button"
      onClick={() => { setMode(m); reset(); }}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-sm font-medium rounded-xl transition-colors",
        mode === m ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="w-4 h-4" /> {t(labelKey)}
    </button>
  );

  return (
    <Card className="glass-card border-2 border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{t("today.smartLogTitle")}</p>
          <PortionGuide />
        </div>

        <div role="tablist" className="flex gap-1 p-1 rounded-2xl bg-secondary/50">
          {modeBtn("photo", Camera, "today.modePhoto")}
          {modeBtn("text", Type, "today.modeText")}
          {modeBtn("voice", Mic, "today.modeVoice")}
        </div>

        {!result && !busy && mode === "photo" && (
          <>
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-14 rounded-xl text-base"
            >
              <Camera className="w-5 h-5 mr-2" /> {t("today.takePhoto")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhoto}
            />
          </>
        )}

        {!result && !busy && mode === "text" && (
          <div className="space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("today.describePlaceholder")}
              className="min-h-[80px] text-base rounded-xl"
            />
            <Button
              onClick={handleTextSubmit}
              disabled={!text.trim()}
              className="w-full h-12 rounded-xl"
            >
              {t("today.identify")}
            </Button>
          </div>
        )}

        {!result && !busy && mode === "voice" && (
          <Button
            onClick={recording ? stopRecording : startRecording}
            className={cn("w-full h-14 rounded-xl text-base", recording && "bg-destructive hover:bg-destructive/90")}
          >
            {recording ? (
              <>
                <Square className="w-5 h-5 mr-2" /> {t("today.stopRecording")}
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 mr-2" /> {t("today.startRecording")}
              </>
            )}
          </Button>
        )}

        {busy && (
          <div className="flex items-center gap-3 py-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-base text-muted-foreground">{busyLabel}</p>
          </div>
        )}

        {result && !busy && (
          <div className="space-y-3 pt-1 animate-fade-in">
            <Input
              value={editedLabel}
              onChange={(e) => setEditedLabel(e.target.value)}
              className="text-base h-12 rounded-xl"
            />
            <div className="flex items-center gap-2 text-sm">
              <span className="bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                ~{result.carbsGrams}g carbs
              </span>
              <span className="bg-muted px-2 py-1 rounded-full">
                {t(PORTION_KEYS[result.portionSize])}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t("today.carbsDisclaimer")}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={reset}>
                {t("today.tryAgain")}
              </Button>
              <Button className="flex-1 h-12 rounded-xl" onClick={confirm} disabled={!editedLabel.trim()}>
                <Check className="w-5 h-5 mr-2" /> {t("today.logIt")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
