import { useState } from "react";
import { Gamepad2, Sparkles, Search, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MemoryMatchGame } from "@/components/games/MemoryMatchGame";
import { WordSearchGame } from "@/components/games/WordSearchGame";
import { HigherLowerGame } from "@/components/games/HigherLowerGame";
import { PostGameQuestion } from "./PostGameQuestion";

type GameId = "memory" | "wordsearch" | "higherlower";

interface GameMeta {
  id: GameId;
  title: string;
  description: string;
  icon: typeof Sparkles;
}

const GAMES: GameMeta[] = [
  {
    id: "memory",
    title: "Memory Match",
    description: "Find the matching pairs at your own pace.",
    icon: Layers,
  },
  {
    id: "wordsearch",
    title: "Word Search",
    description: "Spot calming words hidden in the grid.",
    icon: Search,
  },
  {
    id: "higherlower",
    title: "Higher or Lower",
    description: "A quick card game — guess what comes next.",
    icon: Sparkles,
  },
];

type Phase = "play" | "question";

export function GamesSection() {
  const [active, setActive] = useState<GameMeta | null>(null);
  const [phase, setPhase] = useState<Phase>("play");
  const [seenIds, setSeenIds] = useState<string[]>([]);

  const open = (g: GameMeta) => {
    setActive(g);
    setPhase("play");
  };

  const close = () => {
    setActive(null);
    setPhase("play");
  };

  const handleGameFinish = () => setPhase("question");

  return (
    <>
      <Card className="glass-card border-0">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-primary" aria-hidden="true" />
              <h3 className="text-base font-semibold text-foreground">Games & Gentle Learning</h3>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Play for a few minutes, then take a soft moment with a glucose-friendly thought.
          </p>

          <div className="space-y-3">
            {GAMES.map((g) => {
              const Icon = g.icon;
              return (
                <div
                  key={g.id}
                  className="flex items-center gap-3 rounded-2xl border bg-background/40 p-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{g.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{g.description}</p>
                  </div>
                  <Button size="sm" onClick={() => open(g)} className="touch-target">
                    Play
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={active !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {phase === "play" ? active?.title : "A quick thought"}
            </DialogTitle>
            <DialogDescription>
              {phase === "play"
                ? "Take your time. Tap 'I'm done' whenever you'd like to stop."
                : "One small question — no pressure, no scoring."}
            </DialogDescription>
          </DialogHeader>

          {active && phase === "play" && active.id === "memory" && (
            <MemoryMatchGame onFinish={handleGameFinish} />
          )}
          {active && phase === "play" && active.id === "wordsearch" && (
            <WordSearchGame onFinish={handleGameFinish} />
          )}
          {active && phase === "play" && active.id === "higherlower" && (
            <HigherLowerGame onFinish={handleGameFinish} />
          )}

          {active && phase === "question" && (
            <PostGameQuestion
              recentlySeenIds={seenIds}
              onAnswered={(id) => setSeenIds((s) => [...s.slice(-3), id])}
              onDone={close}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
