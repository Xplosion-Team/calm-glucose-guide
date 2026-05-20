import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown } from "lucide-react";

interface HigherLowerGameProps {
  onFinish: () => void;
}

const SUITS = ["♠", "♥", "♦", "♣"] as const;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

interface Card {
  rank: string;
  suit: (typeof SUITS)[number];
  value: number;
}

function deck(): Card[] {
  const out: Card[] = [];
  for (const s of SUITS) {
    RANKS.forEach((r, i) => out.push({ rank: r, suit: s, value: i + 1 }));
  }
  return out.sort(() => Math.random() - 0.5);
}

export function HigherLowerGame({ onFinish }: HigherLowerGameProps) {
  const [pile, setPile] = useState<Card[]>(() => deck());
  const [current, setCurrent] = useState<Card>(() => pile[0] ?? deck()[0]);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [feedback, setFeedback] = useState<"win" | "loss" | null>(null);

  const guess = (dir: "higher" | "lower") => {
    const next = pile[1];
    if (!next) return;
    const correct =
      (dir === "higher" && next.value > current.value) ||
      (dir === "lower" && next.value < current.value) ||
      next.value === current.value; // tie is a freebie
    setCurrent(next);
    setPile((p) => p.slice(1));
    if (correct) {
      setStreak((s) => {
        const ns = s + 1;
        setBest((b) => Math.max(b, ns));
        return ns;
      });
      setFeedback("win");
    } else {
      setStreak(0);
      setFeedback("loss");
    }
    setTimeout(() => setFeedback(null), 600);
  };

  const reshuffle = () => {
    const d = deck();
    setPile(d);
    setCurrent(d[0]);
    setStreak(0);
    setFeedback(null);
  };

  const isRed = current.suit === "♥" || current.suit === "♦";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-base">
        <span className="text-muted-foreground">
          Streak: <span className="font-semibold text-foreground tabular-nums">{streak}</span>
        </span>
        <span className="text-muted-foreground">
          Best: <span className="font-semibold text-foreground tabular-nums">{best}</span>
        </span>
      </div>

      <div className="flex justify-center">
        <div
          className={`w-40 h-56 rounded-2xl bg-card border-2 shadow-lg flex flex-col items-center justify-center transition-transform ${
            feedback === "win" ? "border-primary scale-105" : feedback === "loss" ? "border-destructive" : "border-border"
          }`}
          aria-live="polite"
        >
          <span className={`text-6xl font-bold ${isRed ? "text-destructive" : "text-foreground"}`}>
            {current.rank}
          </span>
          <span className={`text-5xl ${isRed ? "text-destructive" : "text-foreground"}`}>{current.suit}</span>
        </div>
      </div>

      <p className="text-center text-base text-muted-foreground">
        Will the next card be higher or lower?
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="touch-target h-14 text-lg gap-2"
          onClick={() => guess("lower")}
        >
          <ArrowDown className="w-5 h-5" /> Lower
        </Button>
        <Button className="touch-target h-14 text-lg gap-2" onClick={() => guess("higher")}>
          <ArrowUp className="w-5 h-5" /> Higher
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1 touch-target" onClick={reshuffle}>
          Reshuffle
        </Button>
        <Button variant="outline" className="flex-1 touch-target" onClick={onFinish}>
          I'm done
        </Button>
      </div>
    </div>
  );
}
