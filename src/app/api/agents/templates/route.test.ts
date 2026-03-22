import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/agents/templates", () => {
  it("returns all templates", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates).toBeDefined();
    expect(Array.isArray(body.templates)).toBe(true);
    expect(body.templates.length).toBe(6);
  });

  it("each template has the correct shape", async () => {
    const res = await GET();
    const body = await res.json();
    for (const t of body.templates) {
      expect(t).toHaveProperty("id");
      expect(t).toHaveProperty("name");
      expect(t).toHaveProperty("description");
      expect(t).toHaveProperty("icon");
      expect(t).toHaveProperty("systemPrompt");
      expect(t).toHaveProperty("suggestedQueries");
      expect(typeof t.id).toBe("string");
      expect(typeof t.name).toBe("string");
      expect(typeof t.systemPrompt).toBe("string");
      expect(Array.isArray(t.suggestedQueries)).toBe(true);
      expect(t.suggestedQueries.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("template IDs are unique", async () => {
    const res = await GET();
    const body = await res.json();
    const ids = body.templates.map((t: { id: string }) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
