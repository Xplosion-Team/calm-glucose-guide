import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface WordSearchGameProps {
  onFinish: () => void;
}

const WORDS = ["WALK", "WATER", "SLEEP", "FIBER", "CALM", "GREENS"];
const SIZE = 9;

interface Placed {
  word: string;
  cells: number[]; // flat indices
}

function buildBoard(): { grid: string[]; placed: Placed[] } {
  const grid: string[] = Array(SIZE * SIZE).fill("");
  const placed: Placed[] = [];
  const dirs = [
    [1, 0], // right
    [0, 1], // down
    [1, 1], // diag
  ];

  for (const word of WORDS) {
    let tries = 0;
    while (tries < 200) {
      tries++;
      const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
      const maxX = SIZE - word.length * dx;
      const maxY = SIZE - word.length * dy;
      const x = Math.floor(Math.random() * (maxX + 1));
      const y = Math.floor(Math.random() * (maxY + 1));
      const cells: number[] = [];
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const px = x + dx * i;
        const py = y + dy * i;
        const idx = py * SIZE + px;
        if (grid[idx] && grid[idx] !== word[i]) {
          ok = false;
          break;
        }
        cells.push(idx);
      }
      if (!ok) continue;
      cells.forEach((idx, i) => (grid[idx] = word[i]));
      placed.push({ word, cells });
      break;
    }
  }

  // fill blanks
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i]) grid[i] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  }
  return { grid, placed };
}

export function WordSearchGame({ onFinish }: WordSearchGameProps) {
  const board = useMemo(buildBoard, []);
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [start, setStart] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const cellsBetween = (a: number, b: number): number[] | null => {
    const ax = a % SIZE,
      ay = Math.floor(a / SIZE);
    const bx = b % SIZE,
      by = Math.floor(b / SIZE);
    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    const lenX = Math.abs(bx - ax);
    const lenY = Math.abs(by - ay);
    if (lenX !== 0 && lenY !== 0 && lenX !== lenY) return null;
    const len = Math.max(lenX, lenY) + 1;
    const cells: number[] = [];
    for (let i = 0; i < len; i++) {
      cells.push((ay + dy * i) * SIZE + (ax + dx * i));
    }
    return cells;
  };

  const handleCell = (idx: number) => {
    if (start === null) {
      setStart(idx);
      return;
    }
    const cells = cellsBetween(start, idx);
    setStart(null);
    setHover(null);
    if (!cells) return;
    const text = cells.map((c) => board.grid[c]).join("");
    const matchWord = WORDS.find(
      (w) => !foundWords.includes(w) && (w === text || w === text.split("").reverse().join("")),
    );
    if (matchWord) {
      const placed = board.placed.find((p) => p.word === matchWord);
      if (placed) {
        const same =
          cells.length === placed.cells.length &&
          (cells.every((c, i) => c === placed.cells[i]) ||
            cells.every((c, i) => c === placed.cells[placed.cells.length - 1 - i]));
        if (same) setFoundWords((f) => [...f, matchWord]);
      }
    }
  };

  const foundCells = new Set(
    board.placed.filter((p) => foundWords.includes(p.word)).flatMap((p) => p.cells),
  );
  const previewCells =
    start !== null && hover !== null ? new Set(cellsBetween(start, hover) ?? []) : new Set<number>();

  const allFound = foundWords.length === WORDS.length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Tap the first letter of a word, then the last letter.
      </p>

      <div
        className="grid gap-1 select-none"
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Word search board"
      >
        {board.grid.map((ch, idx) => {
          const isFound = foundCells.has(idx);
          const isStart = start === idx;
          const isPreview = previewCells.has(idx);
          return (
            <button
              key={idx}
              onClick={() => handleCell(idx)}
              onMouseEnter={() => start !== null && setHover(idx)}
              className={`aspect-square rounded-md text-base sm:text-lg font-semibold flex items-center justify-center transition-colors ${
                isFound
                  ? "bg-primary/30 text-foreground"
                  : isStart
                    ? "bg-primary text-primary-foreground"
                    : isPreview
                      ? "bg-primary/15 text-foreground"
                      : "bg-secondary/40 text-foreground hover:bg-secondary"
              }`}
            >
              {ch}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {WORDS.map((w) => {
          const done = foundWords.includes(w);
          return (
            <span
              key={w}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                done
                  ? "bg-primary/15 text-primary line-through"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {w}
            </span>
          );
        })}
      </div>

      {allFound ? (
        <div className="rounded-2xl bg-accent/40 p-4 text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">You found them all.</p>
          <Button className="w-full touch-target text-lg" onClick={onFinish}>Continue</Button>
        </div>
      ) : (
        <Button variant="outline" className="w-full touch-target" onClick={onFinish}>
          I'm done
        </Button>
      )}
    </div>
  );
}
