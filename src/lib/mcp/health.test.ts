import { describe, expect, it } from "vitest";
import {
  classifyMcpHealth,
  nextMcpReconnectAfter,
  snapshotMcpTools,
} from "./health";

describe("MCP health helpers", () => {
  it("creates stable sorted tool snapshots", () => {
    expect(snapshotMcpTools(["beta", "alpha", "beta"], "2026-04-29T12:00:00.000Z")).toEqual([
      { name: "alpha", lastSeenAt: "2026-04-29T12:00:00.000Z" },
      { name: "beta", lastSeenAt: "2026-04-29T12:00:00.000Z" },
    ]);
  });

  it("classifies auth and empty-tool states", () => {
    expect(classifyMcpHealth({ success: true, toolCount: 3 })).toBe("healthy");
    expect(classifyMcpHealth({ success: true, toolCount: 0 })).toBe("degraded");
    expect(classifyMcpHealth({ success: false, requiresOAuth: true })).toBe("reauth_required");
    expect(classifyMcpHealth({ success: false })).toBe("down");
  });

  it("backs off reconnect attempts with a one-hour cap", () => {
    const now = new Date("2026-04-29T12:00:00.000Z").getTime();
    expect(nextMcpReconnectAfter(1, now)).toBe("2026-04-29T12:01:00.000Z");
    expect(nextMcpReconnectAfter(4, now)).toBe("2026-04-29T12:08:00.000Z");
    expect(nextMcpReconnectAfter(12, now)).toBe("2026-04-29T13:00:00.000Z");
  });
});
