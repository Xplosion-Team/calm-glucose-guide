import { useMemo, useState } from "react";
import { Loader2, Send, Utensils, Activity, Moon, Coffee, Pill, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useScreenContext } from "@/hooks/useScreenContext";

interface Props { currentGlucose: number }

type Category = "eat" | "activity" | "sleep" | "drink" | "meds";

interface Prompt {
  id: Category;
  icon: typeof Utensils;
  title: string;
  prefix: string;
  placeholder: string;
  examples: string[];
}

const PROMPTS: Prompt[] = [
  {
    id: "eat",
    icon: Utensils,
    title: "What if I eat…",
    prefix: "What if I eat",
    placeholder: "a turkey sandwich and an apple",
    examples: ["a bowl of oatmeal with berries", "two slices of pizza", "grilled chicken salad"],
  },
  {
    id: "activity",
    icon: Activity,
    title: "What if I do this activity…",
    prefix: "What if I",
    placeholder: "take a 20-minute walk after lunch",
    examples: ["go for a 30-minute walk", "do light gardening for an hour", "ride a stationary bike for 15 minutes"],
  },
  {
    id: "drink",
    icon: Coffee,
    title: "What if I drink…",
    prefix: "What if I drink",
    placeholder: "a glass of orange juice",
    examples: ["a cup of coffee with milk", "a can of regular soda", "a glass of water with lemon"],
  },
  {
    id: "sleep",
    icon: Moon,
    title: "What if I sleep…",
    prefix: "What if I",
    placeholder: "only get 5 hours of sleep tonight",
    examples: ["sleep in until 10am", "take a short afternoon nap", "go to bed two hours later"],
  },
  {
    id: "meds",
    icon: Pill,
    title: "What if I change my routine…",
    prefix: "What if I",
    placeholder: "skip my evening walk",
    examples: ["eat dinner two hours earlier", "have a snack before bed", "skip breakfast tomorrow"],
  },
];

interface Answer {
  question: string;
  text: string;
}

export function WhatIfExplorer({ currentGlucose }: Props) {
  const [active, setActive] = useState<Category | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const prompt = PROMPTS.find((p) => p.id === active) ?? null;

  const ask = async (override?: string) => {
    if (!prompt) return;
    const detail = (override ?? text).trim();
    if (!detail) return;
    const question = `${prompt.prefix} ${detail}?`;
    setLoading(true); setErr(null); setAnswer(null);
    try {
      const { data, error } = await supabase.functions.invoke("predict-meal", {
        body: {
          mode: "what_if",
          question,
          category: prompt.id,
          detail,
          current_glucose_mg_dl: currentGlucose,
        },
      });
      if (error) throw error;
      const insight =
        (data as { insight_text?: string })?.insight_text ??
        "Here's a gentle thought: small, steady choices usually make the biggest difference. Try this and see how your body responds.";
      setAnswer({ question, text: insight });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not answer right now.");
    } finally {
      setLoading(false);
    }
  };

  useScreenContext(
    useMemo(
      () => ({
        screen: "What If Explorer",
        status: answer
          ? `Last question: ${answer.question}`
          : "Pick a category and ask a what-if question.",
        highlights: [
          "Ask gentle 'what if' questions about eating, moving, sleeping, or drinking.",
          "These are friendly estimates — your care team's guidance always comes first.",
        ],
        fallback: "You're on the What-If screen. Pick a category like 'eat' or 'activity' and ask a question.",
      }),
      [answer],
    ),
  );

  const reset = () => {
    setActive(null);
    setText("");
    setAnswer(null);
    setErr(null);
  };

  return (
    <div className="space-y-6">
      <div className="text-center py-3">
        <div className="inline-flex items-center gap-2 mb-1">
          <HelpCircle className="w-6 h-6 text-primary" aria-hidden />
          <h2 className="text-2xl font-semibold text-foreground">What if…</h2>
        </div>
        <p className="text-base text-muted-foreground max-w-md mx-auto">
          Ask a gentle question and get a calm, plain-English thought back.
        </p>
      </div>

      {!prompt && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROMPTS.map(({ id, icon: Icon, title }) => (
            <Card
              key={id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setActive(id)}
            >
              <CardContent className="pt-5 pb-5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-5 h-5" aria-hidden />
                </div>
                <div className="text-base font-medium text-foreground">{title}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {prompt && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-base font-medium text-foreground">
              <prompt.icon className="w-5 h-5 text-primary" aria-hidden />
              {prompt.title}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-base text-muted-foreground shrink-0">{prompt.prefix}</span>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={prompt.placeholder}
                className="h-12 text-base"
                onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {prompt.examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => { setText(ex); ask(ex); }}
                  className="text-sm px-3 py-1.5 rounded-full bg-secondary/60 hover:bg-secondary text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={() => ask()} disabled={loading || !text.trim()} className="flex-1 h-12 rounded-xl text-base">
                {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
                {loading ? "Thinking…" : "Ask"}
              </Button>
              <Button variant="ghost" onClick={reset} className="h-12 rounded-xl">
                Back
              </Button>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
          </CardContent>
        </Card>
      )}

      {answer && (
        <Card className="animate-fade-in">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm text-muted-foreground italic">{answer.question}</p>
            <p className="text-base text-foreground leading-relaxed">{answer.text}</p>
            <p className="text-xs text-muted-foreground pt-2">
              Estimate only, not medical advice. Always follow your care team's guidance.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
