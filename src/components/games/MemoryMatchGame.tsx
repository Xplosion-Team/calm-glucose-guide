import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface MemoryMatchGameProps {
  onFinish: () => void;
}

const EMOJIS = ["🌱", "🍎", "🌻", "🫐", "🥕", "🍋", "🌿", "🍇"];

interface Tile {
  id: number;
  emoji: string;
  matched: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function makeDeck(): Tile[] {
  const pairs = [...EMOJIS, ...EMOJIS].map((emoji, id) => ({ id, emoji, matched: false }));
  return shuffle(pairs);
}

export function MemoryMatchGame({ onFinish }: MemoryMatchGameProps) {
  const [tiles, setTiles] = useState<Tile[]>(() => makeDeck());
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);

  const allMatched = tiles.every((t) => t.matched);

  useEffect(() => {
    if (flipped.length !== 2) return;
    const [a, b] = flipped;
    const tileA = tiles.find((t) => t.id === a)!;
    const tileB = tiles.find((t) => t.id === b)!;
    setMoves((m) => m + 1);
    if (tileA.emoji === tileB.emoji) {
      setTiles((prev) =>
        prev.map((t) => (t.id === a || t.id === b ? { ...t, matched: true } : t)),
      );
      setFlipped([]);
    } else {
      const t = setTimeout(() => setFlipped([]), 900);
      return () => clearTimeout(t);
    }
  }, [flipped, tiles]);

  const handleFlip = (id: number) => {
    if (flipped.length === 2) return;
    if (flipped.includes(id)) return;
    if (tiles.find((t) => t.id === id)?.matched) return;
    setFlipped((f) => [...f, id]);
  };

  const reset = () => {
    setTiles(makeDeck());
    setFlipped([]);
    setMoves(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-base">
        <span className="text-muted-foreground">Moves: <span className="font-semibold text-foreground tabular-nums">{moves}</span></span>
        <Button variant="ghost" size="sm" onClick={reset}>Shuffle</Button>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3" role="grid" aria-label="Memory match board">
        {tiles.map((t) => {
          const isUp = flipped.includes(t.id) || t.matched;
          return (
            <button
              key={t.id}
              onClick={() => handleFlip(t.id)}
              disabled={t.matched}
              aria-label={isUp ? `Card showing ${t.emoji}` : "Hidden card"}
              className={`aspect-square rounded-2xl text-4xl sm:text-5xl flex items-center justify-center transition-all touch-target ${
                isUp
                  ? "bg-accent/60 shadow-inner"
                  : "bg-gradient-to-br from-primary/20 to-primary/40 hover:from-primary/25 hover:to-primary/50"
              } ${t.matched ? "opacity-60" : ""}`}
            >
              {isUp ? t.emoji : ""}
            </button>
          );
        })}
      </div>

      {allMatched ? (
        <div className="rounded-2xl bg-accent/40 p-4 text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Lovely — all matched in {moves} moves.</p>
          <Button className="w-full touch-target text-lg" onClick={onFinish}>
            Continue
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="w-full touch-target" onClick={onFinish}>
          I'm done
        </Button>
      )}
    </div>
  );
}
