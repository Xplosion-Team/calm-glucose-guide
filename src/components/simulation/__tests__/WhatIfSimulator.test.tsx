import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { screen, fireEvent } from "@testing-library/dom";
import { WhatIfSimulator } from "../WhatIfSimulator";
import { MealSelector } from "../MealSelector";
import { ExerciseSelector } from "../ExerciseSelector";
import { SimulationResultDisplay } from "../SimulationResult";
import { runSimulation } from "@/lib/simulation-engine";
import type { SimulationResult } from "@/types/simulation";

describe("WhatIfSimulator", () => {
  const defaultProps = { currentGlucose: 120, trend: "stable" as const, predicted60min: 125 };

  it("renders heading and input selectors", () => {
    render(<WhatIfSimulator {...defaultProps} />);
    expect(screen.getByText("What if...?")).toBeInTheDocument();
    expect(screen.getByText("What are you eating?")).toBeInTheDocument();
    expect(screen.getByText("Any movement planned?")).toBeInTheDocument();
  });

  it("disables simulate button when no input selected", () => {
    render(<WhatIfSimulator {...defaultProps} />);
    const btn = screen.getByRole("button", { name: /see what might happen/i });
    expect(btn).toBeDisabled();
  });

  it("enables simulate button after selecting a meal", () => {
    render(<WhatIfSimulator {...defaultProps} />);
    const radio = screen.getByRole("radio", { name: /light meal/i });
    fireEvent.click(radio);
    const btn = screen.getByRole("button", { name: /see what might happen/i });
    expect(btn).not.toBeDisabled();
  });

  it("shows results after clicking simulate", () => {
    render(<WhatIfSimulator {...defaultProps} />);
    fireEvent.click(screen.getByRole("radio", { name: /hearty meal/i }));
    fireEvent.click(screen.getByRole("button", { name: /see what might happen/i }));
    expect(screen.getByText("What might happen")).toBeInTheDocument();
    expect(screen.getByText(/try another scenario/i)).toBeInTheDocument();
  });

  it("resets to input view after clicking try another", () => {
    render(<WhatIfSimulator {...defaultProps} />);
    fireEvent.click(screen.getByRole("radio", { name: /light meal/i }));
    fireEvent.click(screen.getByRole("button", { name: /see what might happen/i }));
    fireEvent.click(screen.getByRole("button", { name: /try another scenario/i }));
    expect(screen.getByText("What are you eating?")).toBeInTheDocument();
  });
});

describe("MealSelector", () => {
  it("renders all meal presets", () => {
    render(<MealSelector value={null} onChange={vi.fn()} />);
    expect(screen.getByText("Light meal")).toBeInTheDocument();
    expect(screen.getByText("Balanced meal")).toBeInTheDocument();
    expect(screen.getByText("Hearty meal")).toBeInTheDocument();
  });

  it("calls onChange with meal data when selected", () => {
    const onChange = vi.fn();
    render(<MealSelector value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /hearty meal/i }));
    expect(onChange).toHaveBeenCalledWith({
      description: "Hearty meal",
      portionSize: "large",
      carbLevel: "high",
    });
  });
});

describe("ExerciseSelector", () => {
  it("renders all exercise presets", () => {
    render(<ExerciseSelector value={null} onChange={vi.fn()} />);
    expect(screen.getByText("Rest or sit")).toBeInTheDocument();
    expect(screen.getByText("Short walk")).toBeInTheDocument();
    expect(screen.getByText("Longer walk")).toBeInTheDocument();
  });

  it("calls onChange with exercise data when selected", () => {
    const onChange = vi.fn();
    render(<ExerciseSelector value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /short walk/i }));
    expect(onChange).toHaveBeenCalledWith({ type: "walking", durationMinutes: 10 });
  });
});

describe("SimulationResultDisplay", () => {
  const mockResult: SimulationResult = {
    simulationSummary: "This meal will likely cause a gentle rise.",
    baselineComparison: "Your blood sugar is currently trending upward.",
    stabilityEffect: "less stable",
    confidenceNote: "Everyone responds a little differently.",
    gentleTip: "Even a short walk after eating can help.",
    projectedTrend: "gentler rise",
  };

  it("renders summary, comparison, and tip", () => {
    render(<SimulationResultDisplay result={mockResult} currentGlucose={120} />);
    expect(screen.getByText(mockResult.simulationSummary)).toBeInTheDocument();
    expect(screen.getByText(mockResult.baselineComparison)).toBeInTheDocument();
    expect(screen.getByText(mockResult.gentleTip!)).toBeInTheDocument();
    expect(screen.getByText(mockResult.confidenceNote)).toBeInTheDocument();
  });

  it("shows correct stability badge", () => {
    render(<SimulationResultDisplay result={mockResult} currentGlucose={120} />);
    expect(screen.getByText("Less steady")).toBeInTheDocument();
  });

  it("hides tip when not provided", () => {
    const noTip = { ...mockResult, gentleTip: undefined };
    render(<SimulationResultDisplay result={noTip} currentGlucose={120} />);
    expect(screen.queryByText("A thought")).not.toBeInTheDocument();
  });
});

describe("runSimulation", () => {
  it("returns steeper rise for high-carb large meal", () => {
    const result = runSimulation({
      baseline: { currentGlucose: 120, trend: "stable", predicted60min: 125 },
      userActions: { meal: { description: "Pasta", portionSize: "large", carbLevel: "high" } },
    });
    expect(result.projectedTrend).toBe("steeper rise");
    expect(result.stabilityEffect).toBe("less stable");
  });

  it("returns comes down for long walk only", () => {
    const result = runSimulation({
      baseline: { currentGlucose: 150, trend: "rising", predicted60min: 160 },
      userActions: { exercise: { type: "walking", durationMinutes: 30 } },
    });
    expect(result.projectedTrend).toBe("comes down");
    expect(result.stabilityEffect).toBe("more stable");
  });

  it("returns balanced result for meal + exercise", () => {
    const result = runSimulation({
      baseline: { currentGlucose: 110, trend: "stable", predicted60min: 115 },
      userActions: {
        meal: { description: "Salad", portionSize: "small", carbLevel: "low" },
        exercise: { type: "walking", durationMinutes: 15 },
      },
    });
    expect(["levels off", "stays steady", "comes down"]).toContain(result.projectedTrend);
  });
});
