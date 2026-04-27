import { useMemo, useState, useRef } from "react";
import { useScreenContext } from "@/hooks/useScreenContext";
import { Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MealSelector } from "./MealSelector";
import { ExerciseSelector } from "./ExerciseSelector";
import { SimulationResultDisplay } from "./SimulationResult";
import { BrainQuery } from "@/components/twin/BrainQuery";
import { runSimulation } from "@/lib/simulation-engine";
import type { MealInput, ExerciseInput, SimulationResult } from "@/types/simulation";

interface WhatIfSimulatorProps {
  currentGlucose: number;
  trend: "rising" | "falling" | "stable";
  predicted60min: number;
}

export function WhatIfSimulator({ currentGlucose, trend, predicted60min }: WhatIfSimulatorProps) {
  const [meal, setMeal] = useState<MealInput | null>(null);
  const [exercise, setExercise] = useState<ExerciseInput | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useScreenContext(
    useMemo(
      () => ({
        screen: "What If",
        status: `Your glucose is ${currentGlucose} and ${trend}. Predicted in an hour: ${predicted60min}.`,
        highlights: [
          "Pick a meal and an activity to see how they might change your glucose over the next hour.",
          result
            ? "You've just run a simulation — the result is shown above."
            : "You haven't run a simulation yet on this screen.",
          "Simulations are estimates — they help you imagine, not diagnose.",
        ],
        data: { currentGlucose, trend, predicted60min, hasResult: !!result },
        fallback: `You're on the What If screen. Your glucose is ${currentGlucose} and ${trend}. Try a meal and an activity to see how they might change your glucose. Want more detail?`,
      }),
      [currentGlucose, trend, predicted60min, result],
    ),
  );

  // "Resting" with 0 duration is effectively no action
  const hasInput = meal || (exercise && !(exercise.type === "resting" && exercise.durationMinutes === 0));

  const handleSimulate = () => {
    const simResult = runSimulation({
      baseline: {
        currentGlucose,
        trend,
        predicted60min
      },
      userActions: {
        meal: meal || undefined,
        exercise: exercise || undefined
      }
    });
    setResult(simResult);
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const handleReset = () => {
    setMeal(null);
    setExercise(null);
    setResult(null);
  };

  return (
    <div className="space-y-6" ref={topRef}>
      {/* Introduction */}
      <div className="text-center py-4">
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          What if I…?
        </h2>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Wonder how something might affect your blood sugar? Ask in your own words,
          or pick a common scenario below. Just for learning — not medical advice.
        </p>
      </div>

      {!result ? (
        <>
          {/* Conversational hero — ask in your own words */}
          <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5">
            <BrainQuery currentGlucose={currentGlucose} />
          </div>

          {/* Or pick a scenario */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">or pick a common scenario</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Input selectors */}
          <div className="space-y-4">
            <MealSelector value={meal} onChange={setMeal} />
            <ExerciseSelector value={exercise} onChange={setExercise} />
          </div>

          {/* Simulate button */}
          <div className="flex justify-center pt-4">
            <Button
              size="lg"
              onClick={handleSimulate}
              disabled={!hasInput}
              className="touch-target text-lg px-8 gap-3"
            >
              <Play className="w-5 h-5" />
              See what might happen
            </Button>
          </div>

          {!hasInput && (
            <p className="text-center text-muted-foreground">
              Choose at least one option above to explore
            </p>
          )}
        </>
      ) : (
        <>
          {/* Results */}
          <SimulationResultDisplay 
            result={result} 
            currentGlucose={currentGlucose} 
          />

          {/* Try again button */}
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              size="lg"
              onClick={handleReset}
              className="touch-target text-lg px-8 gap-3"
            >
              <RotateCcw className="w-5 h-5" />
              Try another scenario
            </Button>
          </div>
        </>
      )}

      {/* Safety footer */}
      <div className="text-center pt-6 border-t">
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          This is for learning only. Always follow your care team's guidance 
          for medication and treatment decisions.
        </p>
      </div>
    </div>
  );
}
