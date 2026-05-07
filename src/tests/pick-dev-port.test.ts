import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

const SCRIPT = "node scripts/pick-dev-port.mjs";

function pickPort(seed?: string): number {
  const env = seed ? `TICKET_HASH=${seed} ` : "";
  return Number(execSync(`${env}${SCRIPT}`, { encoding: "utf8" }));
}

describe("pick-dev-port", () => {
  it("returns a port in 4000-4099", () => {
    const port = pickPort("any-seed");
    expect(port).toBeGreaterThanOrEqual(4000);
    expect(port).toBeLessThan(4100);
  });

  it("is deterministic for a given seed", () => {
    expect(pickPort("LAY-X")).toBe(pickPort("LAY-X"));
  });

  it("yields different ports for different seeds (high probability)", () => {
    const ports = ["a", "b", "c", "d", "e"].map((s) => pickPort(s));
    const unique = new Set(ports).size;
    expect(unique).toBeGreaterThanOrEqual(3);
  });
});
