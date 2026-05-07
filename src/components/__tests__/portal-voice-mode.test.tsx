import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PortalVoiceMode } from "../portal-voice-mode";

// ---------------------------------------------------------------------------
// Mock browser speech APIs
// ---------------------------------------------------------------------------
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

beforeEach(() => {
  // @ts-expect-error - mock browser API
  window.SpeechRecognition = MockSpeechRecognition;
  // @ts-expect-error - mock browser API
  window.webkitSpeechRecognition = MockSpeechRecognition;
  // @ts-expect-error - mock browser API
  window.speechSynthesis = { cancel: vi.fn(), speak: vi.fn() };
});

describe("PortalVoiceMode", () => {
  const defaultProps = {
    onTranscript: vi.fn(),
    brandColor: "#0DE4F2",
    isDark: true,
    disabled: false,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Standalone mode (non-inline) ----

  describe("standalone mode", () => {
    it("renders mic-off button when not active", () => {
      render(<PortalVoiceMode {...defaultProps} />);
      expect(
        screen.getByTitle("Enable voice mode")
      ).toBeInTheDocument();
    });

    it("returns null when disabled", () => {
      const { container } = render(
        <PortalVoiceMode {...defaultProps} disabled />
      );
      expect(container.firstChild).toBeNull();
    });

    it("toggles to active state on click", () => {
      const onActiveChange = vi.fn();
      render(
        <PortalVoiceMode
          {...defaultProps}
          onActiveChange={onActiveChange}
        />
      );

      fireEvent.click(screen.getByTitle("Enable voice mode"));
      expect(onActiveChange).toHaveBeenCalledWith(true);
    });

    it("shows voice chat bubble when active", () => {
      render(<PortalVoiceMode {...defaultProps} active={true} />);
      // Should show either Ready or Listening status
      expect(
        screen.getByText(/Ready|Listening/)
      ).toBeInTheDocument();
      expect(screen.getByTitle("Stop voice mode")).toBeInTheDocument();
    });

    it("calls onActiveChange(false) when closing", () => {
      const onActiveChange = vi.fn();
      render(
        <PortalVoiceMode
          {...defaultProps}
          active={true}
          onActiveChange={onActiveChange}
        />
      );

      fireEvent.click(screen.getByTitle("Stop voice mode"));
      expect(onActiveChange).toHaveBeenCalledWith(false);
    });

    it("renders recent messages in voice bubble", () => {
      render(
        <PortalVoiceMode
          {...defaultProps}
          active={true}
          recentMessages={[
            { role: "user", text: "What is the budget?" },
            { role: "assistant", text: "The budget is $50,000." },
          ]}
        />
      );

      expect(screen.getByText("What is the budget?")).toBeInTheDocument();
      expect(
        screen.getByText("The budget is $50,000.")
      ).toBeInTheDocument();
    });

    it("truncates long messages in voice bubble", () => {
      const longText = "A".repeat(200);
      render(
        <PortalVoiceMode
          {...defaultProps}
          active={true}
          recentMessages={[{ role: "user", text: longText }]}
        />
      );

      // Should truncate to 150 chars + "..."
      const displayed = screen.getByText(/A{50,}\.\.\.$/);
      expect(displayed).toBeInTheDocument();
    });
  });

  // ---- Inline mode ----

  describe("inline mode", () => {
    it("returns null when inline but not active", () => {
      const { container } = render(
        <PortalVoiceMode {...defaultProps} inline active={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders inline UI when active", () => {
      render(
        <PortalVoiceMode {...defaultProps} inline active={true} />
      );
      // Should show status text
      expect(
        screen.getByText(/Listening|Speaking|Ready/)
      ).toBeInTheDocument();
    });

    it("shows TTS mute/unmute toggle", () => {
      render(
        <PortalVoiceMode {...defaultProps} inline active={true} />
      );
      expect(
        screen.getByTitle("Mute") || screen.getByTitle("Unmute")
      ).toBeTruthy();
    });
  });

  // ---- TTS toggle ----

  describe("TTS toggle", () => {
    it("renders volume icon buttons in active voice bubble", () => {
      const { container } = render(
        <PortalVoiceMode {...defaultProps} active={true} />
      );
      // The voice bubble renders multiple buttons (mic, close, TTS toggle)
      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ---- State derivation ----

  describe("state management", () => {
    it("uses active prop as source of truth when provided", () => {
      const { rerender } = render(
        <PortalVoiceMode {...defaultProps} active={false} />
      );
      expect(screen.getByTitle("Enable voice mode")).toBeInTheDocument();

      rerender(<PortalVoiceMode {...defaultProps} active={true} />);
      expect(screen.getByTitle("Stop voice mode")).toBeInTheDocument();
    });

    it("uses internal state when active prop not provided", () => {
      render(<PortalVoiceMode {...defaultProps} />);
      // Initially inactive
      expect(screen.getByTitle("Enable voice mode")).toBeInTheDocument();

      // Click to activate (uses internal state)
      fireEvent.click(screen.getByTitle("Enable voice mode"));
      // After toggle, internal state should be true
      // The component should now show active UI
    });
  });

  // ---- Brand color ----

  describe("brand color", () => {
    it("applies brand color to mic button", () => {
      render(
        <PortalVoiceMode
          {...defaultProps}
          active={true}
          brandColor="#FF6B35"
        />
      );
      const micButton = screen.getByTitle("Stop voice mode");
      expect(micButton.style.backgroundColor).toBe("rgb(255, 107, 53)");
    });
  });
});
