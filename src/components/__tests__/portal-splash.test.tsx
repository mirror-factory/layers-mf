import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PortalSplash } from "../portal-splash";

describe("PortalSplash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders splash overlay when not loaded", () => {
    render(
      <PortalSplash loaded={false}>
        <div data-testid="content">Main Content</div>
      </PortalSplash>
    );
    // Splash overlay should be visible
    expect(screen.getByText("Mirror Factory")).toBeInTheDocument();
    expect(screen.getByText(/Proposal prepared by/)).toBeInTheDocument();
  });

  it("renders default subtitle when none provided", () => {
    render(
      <PortalSplash loaded={false}>
        <div>Content</div>
      </PortalSplash>
    );
    expect(
      screen.getByText(/Browse your complete proposal library/)
    ).toBeInTheDocument();
  });

  it("renders custom subtitle", () => {
    render(
      <PortalSplash loaded={false} subtitle="Custom welcome message">
        <div>Content</div>
      </PortalSplash>
    );
    expect(screen.getByText("Custom welcome message")).toBeInTheDocument();
  });

  it("shows client logo with fallback", () => {
    render(
      <PortalSplash loaded={false} clientName="Acme Corp">
        <div>Content</div>
      </PortalSplash>
    );
    const logo = screen.getByAltText("Acme Corp");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/bluewave-logo.svg"); // fallback
  });

  it("shows custom logo URL", () => {
    render(
      <PortalSplash
        loaded={false}
        logoUrl="/acme-logo.svg"
        clientName="Acme Corp"
      >
        <div>Content</div>
      </PortalSplash>
    );
    expect(screen.getByAltText("Acme Corp")).toHaveAttribute(
      "src",
      "/acme-logo.svg"
    );
  });

  it("applies brand color to loading dots", () => {
    const { container } = render(
      <PortalSplash loaded={false} brandColor="#FF6B35">
        <div>Content</div>
      </PortalSplash>
    );
    const dots = container.querySelectorAll(".animate-pulse");
    expect(dots.length).toBeGreaterThanOrEqual(3);
    dots.forEach((dot) => {
      expect((dot as HTMLElement).style.backgroundColor).toBe(
        "rgb(255, 107, 53)"
      );
    });
  });

  it("stays in splash phase when loaded but min time not passed", () => {
    render(
      <PortalSplash loaded={true} minDuration={5000} fadeDuration={500}>
        <div data-testid="content">Main Content</div>
      </PortalSplash>
    );

    // Splash should still show since min time hasn't passed
    expect(screen.getByText("Mirror Factory")).toBeInTheDocument();
  });

  it("starts fading after both loaded and minDuration met", async () => {
    const { rerender } = render(
      <PortalSplash loaded={false} minDuration={100} fadeDuration={100}>
        <div data-testid="content">Main Content</div>
      </PortalSplash>
    );

    // Advance past min duration
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    // Set loaded=true — should trigger fade phase
    rerender(
      <PortalSplash loaded={true} minDuration={100} fadeDuration={100}>
        <div data-testid="content">Main Content</div>
      </PortalSplash>
    );

    // Content div should be in the DOM during fading
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders mirrorfactory.com link with brand color", () => {
    render(
      <PortalSplash loaded={false} brandColor="#22C55E">
        <div>Content</div>
      </PortalSplash>
    );
    const link = screen.getByText("mirrorfactory.com");
    expect(link).toHaveAttribute("href", "https://mirrorfactory.com");
    expect(link.style.color).toBe("rgb(34, 197, 94)");
  });
});
