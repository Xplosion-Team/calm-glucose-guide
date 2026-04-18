import { useState } from "react";
import { Gamepad2, Trophy, Star, Zap, Brain, Target, ChevronRight, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Game {
  id: string;
  title: string;
  description: string;
  icon: typeof Brain;
  duration: string;
  difficulty: "Easy" | "Medium" | "Playful";
  points: number;
}

const GAMES: Game[] = [
  {
    id: "guess",
    title: "Guess the Glucose",
    description: "Predict where your reading will be in 30 minutes — earn points for getting close.",
    icon: Target,
    duration: "1 min",
    difficulty: "Easy",
    points: 10,
  },
  {
    id: "memory",
    title: "Food Match",
    description: "Match the meal to its likely glucose effect. A fun way to learn what affects you.",
    icon: Brain,
    duration: "3 min",
    difficulty: "Medium",
    points: 25,
  },
  {
    id: "streak",
    title: "Steady Streak",
    description: "How many in-range days in a row can you string together? Daily bonus inside.",
    icon: Zap,
    duration: "Daily",
    difficulty: "Playful",
    points: 5,
  },
];

const ACHIEVEMENTS = [
  { id: "1", emoji: "🌱", label: "First steps", earned: true },
  { id: "2", emoji: "🔥", label: "7-day streak", earned: true },
  { id: "3", emoji: "🎯", label: "Sharp eye", earned: true },
  { id: "4", emoji: "🧠", label: "Quick thinker", earned: false },
  { id: "5", emoji: "🏆", label: "30-day club", earned: false },
  { id: "6", emoji: "⭐", label: "Twin master", earned: false },
];

function GuessGame({ onClose, onScore }: { onClose: () => void; onScore: (pts: number) => void }) {
  const [guess, setGuess] = useState<number>(110);
  const [revealed, setRevealed] = useState(false);
  const [actual] = useState(() => 90 + Math.floor(Math.random() * 80));

  const diff = Math.abs(guess - actual);
  const earned = revealed ? Math.max(0, 10 - Math.floor(diff / 5)) : 0;

  return (
    <Card className="glass-card border-0">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Guess the Glucose</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close game">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {!revealed ? (
          <>
            <p className="text-muted-foreground">
              What do you think your glucose will read in 30 minutes?
            </p>
            <div className="text-center py-4">
              <p className="text-5xl font-bold text-primary tabular-nums">{guess}</p>
              <p className="text-sm text-muted-foreground mt-1">mg/dL</p>
            </div>
            <input
              type="range"
              min={60}
              max={250}
              step={1}
              value={guess}
              onChange={(e) => setGuess(Number(e.target.value))}
              className="w-full accent-primary touch-target"
              aria-label="Your guess"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>60</span>
              <span>250</span>
            </div>
            <Button className="w-full touch-target text-lg" onClick={() => setRevealed(true)}>
              Lock it in
            </Button>
          </>
        ) : (
          <div className="text-center space-y-3 py-4">
            <p className="text-muted-foreground">Actual reading would be…</p>
            <p className="text-5xl font-bold text-foreground tabular-nums">{actual}</p>
            <p className="text-base">
              You guessed <span className="font-semibold">{guess}</span> — off by{" "}
              <span className="font-semibold">{diff}</span>.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold">
              <Star className="w-4 h-4" />
              +{earned} points
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Done
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  onScore(earned);
                  onClose();
                }}
              >
                Claim points
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function GamesTab() {
  const { toast } = useToast();
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [points, setPoints] = useState(135);

  const earnedCount = ACHIEVEMENTS.filter((a) => a.earned).length;

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      {/* Hero */}
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 mb-2">
          <Gamepad2 className="w-6 h-6 text-primary" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-foreground">Games</h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Tiny moments to learn about your body — and have a little fun.
        </p>
      </div>

      {/* Stats card */}
      <Card className="glass-card border-0 bg-gradient-to-br from-primary/5 to-accent/30">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Your points</p>
            <p className="text-4xl font-bold text-foreground tabular-nums">{points}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Achievements</p>
            <p className="text-2xl font-semibold text-foreground">
              {earnedCount}<span className="text-muted-foreground text-base">/{ACHIEVEMENTS.length}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Active game */}
      {activeGame === "guess" && (
        <GuessGame
          onClose={() => setActiveGame(null)}
          onScore={(pts) => {
            setPoints((p) => p + pts);
            toast({ title: `+${pts} points!`, description: "Sharp instincts." });
          }}
        />
      )}

      {/* Game list */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground px-1">Play now</h3>
        {GAMES.map((g) => {
          const Icon = g.icon;
          const isActive = activeGame === g.id;
          return (
            <button
              key={g.id}
              onClick={() => {
                if (g.id === "guess") {
                  setActiveGame(isActive ? null : "guess");
                } else {
                  toast({
                    title: "Coming soon",
                    description: `${g.title} is being polished by our team.`,
                  });
                }
              }}
              className="w-full text-left"
            >
              <Card className="glass-card border-0 hover:bg-secondary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-semibold text-foreground truncate">{g.title}</p>
                        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                        {g.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="secondary" className="font-normal">
                          {g.duration}
                        </Badge>
                        <Badge variant="secondary" className="font-normal">
                          {g.difficulty}
                        </Badge>
                        <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                          <Star className="w-3 h-3 fill-current" /> +{g.points}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Achievements */}
      <Card className="glass-card border-0">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" aria-hidden="true" />
            <h3 className="text-base font-semibold text-foreground">Achievements</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {ACHIEVEMENTS.map((a) => (
              <div
                key={a.id}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border ${
                  a.earned
                    ? "bg-accent/40 border-accent"
                    : "bg-muted/30 border-transparent opacity-50"
                }`}
              >
                <span className="text-3xl" aria-hidden="true">{a.emoji}</span>
                <span className="text-xs text-center font-medium text-foreground">{a.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground max-w-sm mx-auto pt-4 border-t">
        Games are for learning and joy — never instead of your care plan.
      </p>
    </div>
  );
}
