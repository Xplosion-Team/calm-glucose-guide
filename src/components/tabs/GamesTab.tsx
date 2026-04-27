import { useEffect, useMemo, useRef, useState } from "react";
import { useScreenContext } from "@/hooks/useScreenContext";
import {
  Gamepad2,
  Trophy,
  Star,
  Spade,
  Heart,
  Club,
  Diamond,
  Clock,
  CheckCircle2,
  ChevronRight,
  X,
  Play,
  Pause,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const SESSION_SECONDS = 5 * 60; // 5 minutes

interface CardGame {
  id: string;
  title: string;
  description: string;
  icon: typeof Spade;
  players: string;
  difficulty: "Relaxing" | "Classic" | "Strategic";
  points: number;
}

const GAMES: CardGame[] = [
  {
    id: "solitaire",
    title: "Solitaire",
    description: "The timeless single-player classic. Sort the cards, clear your mind.",
    icon: Diamond,
    players: "Just you",
    difficulty: "Relaxing",
    points: 20,
  },
  {
    id: "spades",
    title: "Spades",
    description: "Bid, partner up, and take your tricks. A favorite for good reason.",
    icon: Spade,
    players: "4 players",
    difficulty: "Strategic",
    points: 30,
  },
  {
    id: "hearts",
    title: "Hearts",
    description: "Avoid the hearts and the Queen of Spades. Simple to learn, hard to master.",
    icon: Heart,
    players: "4 players",
    difficulty: "Classic",
    points: 25,
  },
  {
    id: "bridge",
    title: "Bridge",
    description: "The thinker's card game. Bid carefully and play with finesse.",
    icon: Club,
    players: "4 players",
    difficulty: "Strategic",
    points: 35,
  },
];

const ACHIEVEMENTS = [
  { id: "1", emoji: "🌱", label: "First hand", earned: true },
  { id: "2", emoji: "🃏", label: "5 games played", earned: true },
  { id: "3", emoji: "📚", label: "Quiz whiz", earned: true },
  { id: "4", emoji: "🧠", label: "Sharp mind", earned: false },
  { id: "5", emoji: "🏆", label: "30-day club", earned: false },
  { id: "6", emoji: "⭐", label: "Bridge master", earned: false },
];

interface QuizQuestion {
  q: string;
  options: string[];
  answerIndex: number;
  explain: string;
}

const QUIZ_BANK: QuizQuestion[] = [
  {
    q: "Which of these is generally considered a healthy fasting glucose range?",
    options: ["40–60 mg/dL", "70–99 mg/dL", "140–180 mg/dL", "200+ mg/dL"],
    answerIndex: 1,
    explain: "A typical healthy fasting reading sits between 70 and 99 mg/dL. Always confirm targets with your care team.",
  },
  {
    q: "After a meal, when does glucose usually peak?",
    options: ["Within 5 minutes", "About 1 to 2 hours later", "After 6 hours", "It does not change"],
    answerIndex: 1,
    explain: "Most people see their post-meal peak about 1 to 2 hours after eating.",
  },
  {
    q: "A gentle 10-minute walk after a meal usually…",
    options: [
      "Spikes glucose higher",
      "Helps lower the post-meal rise",
      "Has no effect",
      "Should be avoided",
    ],
    answerIndex: 1,
    explain: "Light movement after eating helps your muscles use glucose, softening the post-meal rise.",
  },
  {
    q: "Which symptom can be a sign of low blood sugar (hypoglycemia)?",
    options: [
      "Feeling shaky, sweaty, or suddenly very hungry",
      "Improved eyesight",
      "Slower heartbeat",
      "Warm, dry skin",
    ],
    answerIndex: 0,
    explain: "Shakiness, sweating, sudden hunger or confusion can all be signs of a low. Treat quickly and tell someone.",
  },
  {
    q: "Staying well hydrated with water tends to…",
    options: [
      "Raise glucose sharply",
      "Help your body manage glucose",
      "Replace the need for medication",
      "Cause low blood sugar",
    ],
    answerIndex: 1,
    explain: "Good hydration supports the kidneys and helps your body regulate glucose more steadily.",
  },
  {
    q: "Which snack is least likely to cause a sharp glucose spike?",
    options: [
      "A handful of almonds",
      "A glass of fruit juice",
      "White bread with jam",
      "A sugary soda",
    ],
    answerIndex: 0,
    explain: "Nuts are mostly fat and protein with a little fiber, so they tend to nudge glucose only gently.",
  },
  {
    q: "Why is sleep important for glucose management?",
    options: [
      "It has no effect",
      "Poor sleep can make glucose harder to manage the next day",
      "Sleeping less lowers glucose",
      "Only naps matter",
    ],
    answerIndex: 1,
    explain: "Short or restless sleep can raise stress hormones that make glucose harder to keep in range.",
  },
  {
    q: "If your glucose feels low and you're unsure, the safest first step is…",
    options: [
      "Wait and see",
      "Go for a long walk",
      "Check your reading and treat if low",
      "Skip your next meal",
    ],
    answerIndex: 2,
    explain: "When in doubt, check. If you're low, a small fast-acting carb (like juice) usually helps within minutes.",
  },
];

function pickQuestions(n: number): QuizQuestion[] {
  const shuffled = [...QUIZ_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface PlaySessionProps {
  game: CardGame;
  onClose: () => void;
  onComplete: (gamePoints: number, quizPoints: number) => void;
}

function PlaySession({ game, onClose, onComplete }: PlaySessionProps) {
  const [secondsLeft, setSecondsLeft] = useState(SESSION_SECONDS);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState<"play" | "quiz" | "done">("play");
  const [questions] = useState<QuizQuestion[]>(() => pickQuestions(3));
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // Timer
  useEffect(() => {
    if (phase !== "play" || paused) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(intervalRef.current!);
          setPhase("quiz");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [phase, paused]);

  const Icon = game.icon;
  const elapsed = SESSION_SECONDS - secondsLeft;
  const playProgress = (elapsed / SESSION_SECONDS) * 100;

  // PLAY PHASE
  if (phase === "play") {
    return (
      <Card className="glass-card border-0">
        <CardContent className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-foreground">{game.title}</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close game">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Timer */}
          <div className="text-center py-2">
            <div className="inline-flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="w-4 h-4" aria-hidden="true" />
              <span className="text-sm">Time remaining</span>
            </div>
            <p className="text-5xl font-bold text-foreground tabular-nums" aria-live="polite">
              {formatTime(secondsLeft)}
            </p>
          </div>

          <Progress value={playProgress} aria-label="Play session progress" />

          {/* Faux play surface */}
          <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-accent/30 p-6 text-center space-y-3">
            <div className="flex justify-center gap-2 text-primary">
              <Spade className="w-7 h-7" aria-hidden="true" />
              <Heart className="w-7 h-7" aria-hidden="true" />
              <Club className="w-7 h-7" aria-hidden="true" />
              <Diamond className="w-7 h-7" aria-hidden="true" />
            </div>
            <p className="text-base text-foreground font-medium">
              Enjoy your hand of {game.title}.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Take a breath, deal the cards, and play at your pace. We'll check in
              with a couple of friendly questions when the timer ends.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 touch-target"
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? (
                <>
                  <Play className="w-4 h-4 mr-2" aria-hidden="true" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 mr-2" aria-hidden="true" />
                  Pause
                </>
              )}
            </Button>
            <Button
              className="flex-1 touch-target"
              onClick={() => setPhase("quiz")}
            >
              Skip to questions
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // QUIZ PHASE
  if (phase === "quiz") {
    const question = questions[qIndex];
    const isCorrect = revealed && selected === question.options[question.answerIndex];

    const handleNext = () => {
      if (isCorrect) setCorrectCount((c) => c + 1);
      if (qIndex + 1 >= questions.length) {
        setPhase("done");
      } else {
        setQIndex((i) => i + 1);
        setSelected(null);
        setRevealed(false);
      }
    };

    return (
      <Card className="glass-card border-0">
        <CardContent className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              Quick check-in
            </h3>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close quiz">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Question {qIndex + 1} of {questions.length}
          </p>
          <Progress value={((qIndex) / questions.length) * 100} aria-label="Quiz progress" />

          <div className="space-y-3">
            <p className="text-lg font-medium text-foreground leading-relaxed">
              {question.q}
            </p>

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
                    htmlFor={`opt-${i}`}
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
                    <RadioGroupItem
                      id={`opt-${i}`}
                      value={opt}
                      disabled={revealed}
                      className="mt-1"
                    />
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
                <p className="font-semibold mb-1">
                  {isCorrect ? "Nicely done." : "Good try."}
                </p>
                <p className="text-muted-foreground">{question.explain}</p>
              </div>
            )}
          </div>

          {!revealed ? (
            <Button
              className="w-full touch-target text-lg"
              disabled={!selected}
              onClick={() => setRevealed(true)}
            >
              Check answer
            </Button>
          ) : (
            <Button className="w-full touch-target text-lg" onClick={handleNext}>
              {qIndex + 1 >= questions.length ? "See results" : "Next question"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // DONE PHASE
  const quizPoints = correctCount * 10;
  const gamePoints = game.points;
  const total = gamePoints + quizPoints;

  return (
    <Card className="glass-card border-0">
      <CardContent className="p-5 text-center space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">All done</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="py-3 space-y-2">
          <Trophy className="w-12 h-12 text-primary mx-auto" aria-hidden="true" />
          <p className="text-xl text-foreground">
            You answered{" "}
            <span className="font-semibold">{correctCount} of {questions.length}</span> correctly.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Thanks for taking a moment to play and learn. Every little bit helps.
          </p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-primary/5 to-accent/30 p-4 space-y-2">
          <div className="flex items-center justify-between text-base">
            <span className="text-muted-foreground">Game session</span>
            <span className="font-semibold text-foreground">+{gamePoints}</span>
          </div>
          <div className="flex items-center justify-between text-base">
            <span className="text-muted-foreground">Quiz answers</span>
            <span className="font-semibold text-foreground">+{quizPoints}</span>
          </div>
          <div className="border-t pt-2 flex items-center justify-between text-lg">
            <span className="font-semibold text-foreground">Total</span>
            <span className="font-bold text-primary inline-flex items-center gap-1">
              <Star className="w-5 h-5 fill-current" /> +{total}
            </span>
          </div>
        </div>

        <Button
          className="w-full touch-target text-lg"
          onClick={() => {
            onComplete(gamePoints, quizPoints);
            onClose();
          }}
        >
          Claim points
        </Button>
      </CardContent>
    </Card>
  );
}

export function GamesTab() {
  const { toast } = useToast();
  const [activeGame, setActiveGame] = useState<CardGame | null>(null);
  const [points, setPoints] = useState(135);

  const earnedCount = ACHIEVEMENTS.filter((a) => a.earned).length;

  useScreenContext(
    useMemo(
      () => ({
        screen: "Games",
        status: `You have ${points} points and ${earnedCount} achievements so far.`,
        highlights: [
          `Pick a card game like Solitaire or Spades — sessions are 5 minutes.`,
          `After each session, you'll answer a few quick questions about glucose to earn extra points.`,
          `Keep playing to unlock more achievements.`,
        ],
        data: { points, earnedAchievements: earnedCount, totalGames: GAMES.length },
        fallback: `You're on the Games screen. You have ${points} points and ${earnedCount} achievements. Pick a card game for a relaxing five-minute session, then answer a few glucose questions for bonus points. Want more detail?`,
      }),
      [points, earnedCount],
    ),
  );

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      {/* Hero */}
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 mb-2">
          <Gamepad2 className="w-6 h-6 text-primary" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-foreground">Games</h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
          Pick a classic card game, play for five minutes, then answer a couple
          of friendly questions about glucose.
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
              {earnedCount}
              <span className="text-muted-foreground text-base">/{ACHIEVEMENTS.length}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Active session */}
      {activeGame && (
        <PlaySession
          game={activeGame}
          onClose={() => setActiveGame(null)}
          onComplete={(g, q) => {
            const total = g + q;
            setPoints((p) => p + total);
            toast({
              title: `+${total} points!`,
              description: "Lovely play and lovely answers.",
            });
          }}
        />
      )}

      {/* Game list */}
      {!activeGame && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-foreground px-1">Choose a game</h3>
          {GAMES.map((g) => {
            const Icon = g.icon;
            return (
              <button
                key={g.id}
                onClick={() => setActiveGame(g)}
                className="w-full text-left"
                aria-label={`Start a 5 minute session of ${g.title}`}
              >
                <Card className="glass-card border-0 hover:bg-secondary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Icon className="w-6 h-6" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="font-semibold text-foreground text-lg truncate">{g.title}</p>
                          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />
                        </div>
                        <p className="text-base text-muted-foreground leading-relaxed mt-1">
                          {g.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="secondary" className="font-normal">
                            <Clock className="w-3 h-3 mr-1" aria-hidden="true" />
                            5 min
                          </Badge>
                          <Badge variant="secondary" className="font-normal">
                            {g.players}
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
      )}

      {/* Achievements */}
      {!activeGame && (
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
      )}

      <p className="text-center text-sm text-muted-foreground max-w-sm mx-auto pt-4 border-t leading-relaxed">
        Games are for relaxation and learning — never instead of your care plan.
      </p>
    </div>
  );
}
