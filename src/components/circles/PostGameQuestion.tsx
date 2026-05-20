import { useMemo, useState } from "react";
import { CheckCircle2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { pickRandomQuestion } from "@/lib/games/glucose-questions";

interface PostGameQuestionProps {
  onDone: () => void;
  recentlySeenIds?: string[];
  onAnswered?: (questionId: string) => void;
}

export function PostGameQuestion({ onDone, recentlySeenIds = [], onAnswered }: PostGameQuestionProps) {
  const question = useMemo(() => pickRandomQuestion(recentlySeenIds), [recentlySeenIds]);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const isCorrect = revealed && selected === question.options[question.answerIndex];

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <Heart className="w-8 h-8 text-primary mx-auto" aria-hidden="true" />
        <h3 className="text-xl font-semibold text-foreground">Nice round.</h3>
        <p className="text-base text-muted-foreground leading-relaxed">
          Here's a gentle thought to take with you.
        </p>
      </div>

      <p className="text-lg font-medium text-foreground leading-relaxed">{question.q}</p>

      <RadioGroup
        value={selected ?? ""}
        onValueChange={(v) => !revealed && setSelected(v)}
        className="space-y-2"
      >
        {question.options.map((opt, i) => {
          const isAnswer = i === question.answerIndex;
          const isPicked = selected === opt;
          const showCorrect = revealed && isAnswer;
          const showWrong = revealed && isPicked && !isAnswer;
          return (
            <Label
              key={opt}
              htmlFor={`pgq-opt-${i}`}
              className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors text-base font-normal ${
                showCorrect
                  ? "border-primary bg-primary/10"
                  : showWrong
                    ? "border-destructive bg-destructive/10"
                    : isPicked
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-secondary/30"
              }`}
            >
              <RadioGroupItem id={`pgq-opt-${i}`} value={opt} disabled={revealed} className="mt-1" />
              <span className="flex-1 text-foreground leading-relaxed">{opt}</span>
              {showCorrect && (
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" aria-label="Correct" />
              )}
            </Label>
          );
        })}
      </RadioGroup>

      {revealed && (
        <div className="rounded-xl bg-accent/40 p-4 text-base text-foreground leading-relaxed">
          <p className="font-semibold mb-1">{isCorrect ? "Nicely done." : "Good try."}</p>
          <p className="text-muted-foreground">{question.explain}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1 touch-target" onClick={onDone}>
          Skip for now
        </Button>
        {!revealed ? (
          <Button
            className="flex-1 touch-target text-lg"
            disabled={!selected}
            onClick={() => {
              setRevealed(true);
              onAnswered?.(question.id);
            }}
          >
            Check
          </Button>
        ) : (
          <Button className="flex-1 touch-target text-lg" onClick={onDone}>
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
