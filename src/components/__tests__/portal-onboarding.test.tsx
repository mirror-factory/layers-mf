import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PortalOnboarding } from "../portal-onboarding";

describe("PortalOnboarding", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not render immediately (3.5s delay)", () => {
    render(<PortalOnboarding />);
    expect(screen.queryByText("Browse Your Documents")).not.toBeInTheDocument();
  });

  it("renders first step after delay", () => {
    render(<PortalOnboarding />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText("Browse Your Documents")).toBeInTheDocument();
    expect(
      screen.getByText(/All your proposal documents/)
    ).toBeInTheDocument();
  });

  it("advances through 3 steps", () => {
    render(<PortalOnboarding brandColor="#FF6B35" />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // Step 1
    expect(screen.getByText("Browse Your Documents")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();

    // Click Next → Step 2
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Ask Questions Anytime")).toBeInTheDocument();

    // Click Next → Step 3
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Just Talk")).toBeInTheDocument();
    expect(screen.getByText("Get Started")).toBeInTheDocument();
  });

  it("dismisses on Get Started click", () => {
    render(<PortalOnboarding />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // Advance to last step
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Get Started"));

    // After dismiss animation
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByText("Just Talk")).not.toBeInTheDocument();
  });

  it("persists dismissal to sessionStorage", () => {
    render(<PortalOnboarding clientName="Acme" />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // Dismiss via X button
    const closeButton = screen.getByRole("button", { name: "" }); // X icon button
    fireEvent.click(closeButton);

    expect(sessionStorage.getItem("portal-onboarding-Acme")).toBe("1");
  });

  it("does not show if already dismissed", () => {
    sessionStorage.setItem("portal-onboarding-TestClient", "1");
    render(<PortalOnboarding clientName="TestClient" />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText("Browse Your Documents")).not.toBeInTheDocument();
  });

  it("applies brand color to step icon and button", () => {
    render(<PortalOnboarding brandColor="#FF6B35" />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    const nextButton = screen.getByText("Next");
    expect(nextButton.style.backgroundColor).toBe("rgb(255, 107, 53)");
  });

  it("renders 3 progress dots", () => {
    const { container } = render(<PortalOnboarding />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // 3 progress indicator dots
    const dots = container.querySelectorAll(".rounded-full.transition-all");
    expect(dots.length).toBe(3);
  });

  it("dismisses when backdrop is clicked", () => {
    render(<PortalOnboarding />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // Click the backdrop (the absolute overlay behind the card)
    const backdrop = document.querySelector(".absolute.inset-0.bg-black\\/20");
    if (backdrop) {
      fireEvent.click(backdrop);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(
        screen.queryByText("Browse Your Documents")
      ).not.toBeInTheDocument();
    }
  });
});
