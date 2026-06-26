import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OnboardingChecklist, type ChecklistItem } from "../OnboardingChecklist";
import { OnboardingTour } from "../OnboardingTour";

// ─── Helpers ────────────────────────────────────────────────

const MOCK_ITEMS: ChecklistItem[] = [
  { id: "view_glucose", label: "View your glucose reading", description: "Check the main circle.", completed: false },
  { id: "check_predictions", label: "Check your predictions", description: "Look at the predictions.", completed: false },
  { id: "try_whatif", label: "Try a What-If scenario", description: "Go to What If tab.", completed: true },
  { id: "explore_twin", label: "Explore your Digital Twin", description: "Visit Twin tab.", completed: false },
  { id: "connect_dexcom", label: "Connect to your T1Pal", description: "Link your T1Pal account.", completed: false },
];

const ALL_DONE: ChecklistItem[] = MOCK_ITEMS.map((i) => ({ ...i, completed: true }));

// ─── OnboardingChecklist ────────────────────────────────────

describe("OnboardingChecklist", () => {
  let onStartTour: ReturnType<typeof vi.fn>;
  let onResetChecklist: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onStartTour = vi.fn();
    onResetChecklist = vi.fn();
  });

  it("renders all checklist items with labels", () => {
    render(<OnboardingChecklist items={MOCK_ITEMS} onStartTour={onStartTour} onResetChecklist={onResetChecklist} />);
    MOCK_ITEMS.forEach((item) => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    });
  });

  it("shows correct progress count", () => {
    render(<OnboardingChecklist items={MOCK_ITEMS} onStartTour={onStartTour} onResetChecklist={onResetChecklist} />);
    expect(screen.getByText("1/5")).toBeInTheDocument();
  });

  it("shows 'Start Tour' button when not all done", () => {
    render(<OnboardingChecklist items={MOCK_ITEMS} onStartTour={onStartTour} onResetChecklist={onResetChecklist} />);
    expect(screen.getByText("Start Tour")).toBeInTheDocument();
  });

  it("shows 'Replay Tour' and Reset when all done", () => {
    render(<OnboardingChecklist items={ALL_DONE} onStartTour={onStartTour} onResetChecklist={onResetChecklist} />);
    expect(screen.getByText("Replay Tour")).toBeInTheDocument();
    expect(screen.getByText("Reset")).toBeInTheDocument();
    expect(screen.getByText(/You're all set/)).toBeInTheDocument();
  });

  it("calls onStartTour when Start Tour is clicked", () => {
    render(<OnboardingChecklist items={MOCK_ITEMS} onStartTour={onStartTour} onResetChecklist={onResetChecklist} />);
    fireEvent.click(screen.getByText("Start Tour"));
    expect(onStartTour).toHaveBeenCalledOnce();
  });

  it("calls onResetChecklist when Reset is clicked", () => {
    render(<OnboardingChecklist items={ALL_DONE} onStartTour={onStartTour} onResetChecklist={onResetChecklist} />);
    fireEvent.click(screen.getByText("Reset"));
    expect(onResetChecklist).toHaveBeenCalledOnce();
  });

  it("collapses and expands when header is clicked", () => {
    render(<OnboardingChecklist items={MOCK_ITEMS} onStartTour={onStartTour} onResetChecklist={onResetChecklist} />);
    // Initially expanded — items visible
    expect(screen.getByText("View your glucose reading")).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByText("Getting Started"));
    expect(screen.queryByText("View your glucose reading")).not.toBeInTheDocument();

    // Expand again
    fireEvent.click(screen.getByText("Getting Started"));
    expect(screen.getByText("View your glucose reading")).toBeInTheDocument();
  });

  it("has fixed positioning with desktop classes (matchMedia defaults to non-mobile)", () => {
    const { container } = render(
      <OnboardingChecklist items={MOCK_ITEMS} onStartTour={onStartTour} onResetChecklist={onResetChecklist} />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("fixed");
    // Desktop layout (matchMedia returns matches:false by default in test setup)
    expect(root.className).toContain("bottom-20");
    expect(root.className).toContain("right-4");
    expect(root.className).toContain("w-80");
  });

  it("renders descriptions on desktop (non-mobile)", () => {
    render(<OnboardingChecklist items={MOCK_ITEMS} onStartTour={onStartTour} onResetChecklist={onResetChecklist} />);
    MOCK_ITEMS.forEach((item) => {
      expect(screen.getByText(item.description)).toBeInTheDocument();
    });
  });

  it("applies line-through style to completed items", () => {
    render(<OnboardingChecklist items={MOCK_ITEMS} onStartTour={onStartTour} onResetChecklist={onResetChecklist} />);
    const completedLabel = screen.getByText("Try a What-If scenario");
    expect(completedLabel.className).toContain("line-through");
  });
});

// ─── OnboardingTour ─────────────────────────────────────────

describe("OnboardingTour", () => {
  it("renders without crashing when run=false", () => {
    const { container } = render(
      <OnboardingTour run={false} onFinish={vi.fn()} activeTab="journey" onChangeTab={vi.fn()} />
    );
    expect(container).toBeDefined();
  });

  it("switches to 'journey' tab when tour starts on different tab", () => {
    const onChangeTab = vi.fn();
    render(
      <OnboardingTour run={true} onFinish={vi.fn()} activeTab="twin" onChangeTab={onChangeTab} />
    );
    expect(onChangeTab).toHaveBeenCalledWith("journey");
  });

  it("does not switch tab when already on 'journey'", () => {
    const onChangeTab = vi.fn();
    render(
      <OnboardingTour run={true} onFinish={vi.fn()} activeTab="journey" onChangeTab={onChangeTab} />
    );
    expect(onChangeTab).not.toHaveBeenCalled();
  });
});

// ─── useOnboarding hook ─────────────────────────────────────

import { renderHook, act } from "@testing-library/react";
import { useOnboarding } from "@/hooks/useOnboarding";

describe("useOnboarding", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns 5 checklist items by default", () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.checklist).toHaveLength(5);
    expect(result.current.checklist.every((i) => !i.completed)).toBe(true);
  });

  it("completeItem marks item as completed and persists to localStorage", () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.completeItem("try_whatif"));
    expect(result.current.checklist.find((i) => i.id === "try_whatif")?.completed).toBe(true);

    const saved = JSON.parse(localStorage.getItem("calm-glucose-onboarding")!);
    expect(saved.checklist.try_whatif).toBe(true);
  });

  it("finishTour marks tour completed and auto-completes first two items", () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.finishTour());
    expect(result.current.tourRunning).toBe(false);
    expect(result.current.checklist.find((i) => i.id === "view_glucose")?.completed).toBe(true);
    expect(result.current.checklist.find((i) => i.id === "check_predictions")?.completed).toBe(true);
  });

  it("resetOnboarding clears all progress", () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => {
      result.current.completeItem("try_whatif");
      result.current.completeItem("explore_twin");
    });
    act(() => result.current.resetOnboarding());
    expect(result.current.checklist.every((i) => !i.completed)).toBe(true);
  });

  it("startTour sets tourRunning to true", () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.startTour());
    expect(result.current.tourRunning).toBe(true);
  });

  it("loads persisted state from localStorage", () => {
    localStorage.setItem(
      "calm-glucose-onboarding",
      JSON.stringify({ tourCompleted: true, dismissed: false, checklist: { try_whatif: true, explore_twin: true } })
    );
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.checklist.find((i) => i.id === "try_whatif")?.completed).toBe(true);
    expect(result.current.checklist.find((i) => i.id === "explore_twin")?.completed).toBe(true);
    expect(result.current.checklist.find((i) => i.id === "view_glucose")?.completed).toBe(false);
  });
});
