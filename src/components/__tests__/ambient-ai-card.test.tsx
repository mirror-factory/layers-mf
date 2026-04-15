import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AmbientAICard,
  type AmbientAISuggestion,
} from "../ambient-ai-card";

function makeSuggestion(
  overrides: Partial<AmbientAISuggestion> = {}
): AmbientAISuggestion {
  return {
    id: "sug-1",
    type: "info",
    title: "Helpful suggestion",
    body: "This could save you time.",
    actions: ["accept", "dismiss", "modify"],
    ...overrides,
  };
}

describe("AmbientAICard", () => {
  it("renders title and body", () => {
    render(
      <AmbientAICard
        suggestion={makeSuggestion()}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onModify={vi.fn()}
      />
    );

    expect(screen.getByText("Helpful suggestion")).toBeInTheDocument();
    expect(screen.getByText("This could save you time.")).toBeInTheDocument();
  });

  it("shows Lightbulb icon for info type", () => {
    render(
      <AmbientAICard
        suggestion={makeSuggestion({ type: "info" })}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onModify={vi.fn()}
      />
    );

    expect(screen.getByLabelText("info suggestion")).toBeInTheDocument();
  });

  it("shows Zap icon for action type", () => {
    render(
      <AmbientAICard
        suggestion={makeSuggestion({ type: "action" })}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onModify={vi.fn()}
      />
    );

    expect(screen.getByLabelText("action suggestion")).toBeInTheDocument();
  });

  it("shows HelpCircle icon for question type", () => {
    render(
      <AmbientAICard
        suggestion={makeSuggestion({ type: "question" })}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onModify={vi.fn()}
      />
    );

    expect(screen.getByLabelText("question suggestion")).toBeInTheDocument();
  });

  it("renders source citation when provided", () => {
    render(
      <AmbientAICard
        suggestion={makeSuggestion({ source: "Project docs" })}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onModify={vi.fn()}
      />
    );

    expect(screen.getByText("Source: Project docs")).toBeInTheDocument();
  });

  it("does not render source when not provided", () => {
    render(
      <AmbientAICard
        suggestion={makeSuggestion({ source: undefined })}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onModify={vi.fn()}
      />
    );

    expect(screen.queryByText(/Source:/)).not.toBeInTheDocument();
  });

  it("calls onAccept when Accept button is clicked", () => {
    const onAccept = vi.fn();
    render(
      <AmbientAICard
        suggestion={makeSuggestion()}
        onAccept={onAccept}
        onDismiss={vi.fn()}
        onModify={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Use this"));
    expect(onAccept).toHaveBeenCalledWith("sug-1");
  });

  it("calls onDismiss when Dismiss button is clicked", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <AmbientAICard
        suggestion={makeSuggestion()}
        onAccept={vi.fn()}
        onDismiss={onDismiss}
        onModify={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Not now"));
    // Dismiss is delayed for the opacity transition
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onDismiss).toHaveBeenCalledWith("sug-1");
    vi.useRealTimers();
  });

  it("shows input when Tell me more is clicked", () => {
    render(
      <AmbientAICard
        suggestion={makeSuggestion()}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onModify={vi.fn()}
      />
    );

    expect(screen.queryByPlaceholderText("Ask a follow-up...")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Tell me more"));
    expect(screen.getByPlaceholderText("Ask a follow-up...")).toBeInTheDocument();
  });

  it("calls onModify with prompt text when Send is clicked", () => {
    const onModify = vi.fn();
    render(
      <AmbientAICard
        suggestion={makeSuggestion()}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onModify={onModify}
      />
    );

    fireEvent.click(screen.getByText("Tell me more"));
    const input = screen.getByPlaceholderText("Ask a follow-up...");
    fireEvent.change(input, { target: { value: "Can you elaborate?" } });
    fireEvent.click(screen.getByText("Send"));

    expect(onModify).toHaveBeenCalledWith("sug-1", "Can you elaborate?");
  });

  it("calls onModify on Enter key press", () => {
    const onModify = vi.fn();
    render(
      <AmbientAICard
        suggestion={makeSuggestion()}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onModify={onModify}
      />
    );

    fireEvent.click(screen.getByText("Tell me more"));
    const input = screen.getByPlaceholderText("Ask a follow-up...");
    fireEvent.change(input, { target: { value: "More details please" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onModify).toHaveBeenCalledWith("sug-1", "More details please");
  });

  it("closes modify input on Escape key", () => {
    render(
      <AmbientAICard
        suggestion={makeSuggestion()}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onModify={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Tell me more"));
    const input = screen.getByPlaceholderText("Ask a follow-up...");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByPlaceholderText("Ask a follow-up...")).not.toBeInTheDocument();
  });

  it("only renders action buttons included in actions array", () => {
    render(
      <AmbientAICard
        suggestion={makeSuggestion({ actions: ["accept"] })}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onModify={vi.fn()}
      />
    );

    expect(screen.getByText("Use this")).toBeInTheDocument();
    expect(screen.queryByText("Not now")).not.toBeInTheDocument();
    expect(screen.queryByText("Tell me more")).not.toBeInTheDocument();
  });
});
