import { describe, it, expect } from "vitest";
import { AGENT_TEMPLATES, getAgentTemplate } from "../templates";

describe("AGENT_TEMPLATES", () => {
  it("has all 6 templates", () => {
    expect(AGENT_TEMPLATES).toHaveLength(6);
  });

  it("all templates have required fields", () => {
    for (const t of AGENT_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(t.systemPrompt).toBeTruthy();
      expect(t.systemPrompt.length).toBeGreaterThan(10);
      expect(t.suggestedQueries).toBeDefined();
      expect(t.suggestedQueries.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("all template IDs are unique", () => {
    const ids = AGENT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all system prompts are non-empty strings", () => {
    for (const t of AGENT_TEMPLATES) {
      expect(typeof t.systemPrompt).toBe("string");
      expect(t.systemPrompt.trim().length).toBeGreaterThan(0);
    }
  });

  it("each template has a valid outputFormat when defined", () => {
    const validFormats = ["summary", "checklist", "report", "action_items"];
    for (const t of AGENT_TEMPLATES) {
      if (t.outputFormat) {
        expect(validFormats).toContain(t.outputFormat);
      }
    }
  });

  it("contains expected template IDs", () => {
    const ids = AGENT_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("sales-call");
    expect(ids).toContain("sprint-retro");
    expect(ids).toContain("meeting-actions");
    expect(ids).toContain("onboarding");
    expect(ids).toContain("weekly-digest");
    expect(ids).toContain("doc-analyzer");
  });
});

describe("getAgentTemplate", () => {
  it("returns a template by ID", () => {
    const t = getAgentTemplate("sales-call");
    expect(t).toBeDefined();
    expect(t!.name).toBe("Sales Call Analyzer");
  });

  it("returns undefined for unknown ID", () => {
    const t = getAgentTemplate("nonexistent");
    expect(t).toBeUndefined();
  });
});
