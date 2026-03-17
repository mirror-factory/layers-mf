import { describe, it, expect, vi, beforeEach } from "vitest";
import { expandQuery } from "../query-expansion";

// Mock the AI SDK generateObject
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

// Mock the config module
vi.mock("../config", () => ({
  extractionModel: "mock-model",
}));

import { generateObject } from "ai";

const mockGenerateObject = vi.mocked(generateObject);

describe("expandQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the original query for short queries (< 3 words)", async () => {
    const result = await expandQuery("meetings");
    expect(result).toEqual(["meetings"]);
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("returns only the original query for two-word queries", async () => {
    const result = await expandQuery("team sync");
    expect(result).toEqual(["team sync"]);
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("returns original + alternatives for normal queries", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        alternatives: [
          "What decisions were made in recent team meetings?",
          "Team meeting outcomes and action items",
          "Summary of latest team discussions",
        ],
      },
    } as never);

    const result = await expandQuery("what happened in our last team meeting");

    expect(result).toHaveLength(4);
    expect(result[0]).toBe("what happened in our last team meeting");
    expect(result.slice(1)).toEqual([
      "What decisions were made in recent team meetings?",
      "Team meeting outcomes and action items",
      "Summary of latest team discussions",
    ]);
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });

  it("handles errors gracefully by returning just the original query", async () => {
    mockGenerateObject.mockRejectedValue(new Error("API error"));

    const result = await expandQuery("what happened in our last team meeting");

    expect(result).toEqual(["what happened in our last team meeting"]);
  });

  it("filters out empty string alternatives", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        alternatives: ["valid alternative", "", "another valid one"],
      },
    } as never);

    const result = await expandQuery("how is the project going overall");

    expect(result).toEqual([
      "how is the project going overall",
      "valid alternative",
      "another valid one",
    ]);
  });

  it("trims whitespace from the input query", async () => {
    const result = await expandQuery("  hi  ");
    expect(result).toEqual(["hi"]);
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });
});
