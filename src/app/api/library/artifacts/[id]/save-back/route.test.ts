import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveArtifactBackToLibrary: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireUserAndOrg: vi.fn().mockResolvedValue({
    supabase: { from: vi.fn() },
    user: { id: "user-1" },
    orgId: "org-1",
  }),
  isAuthFailure: (value: unknown) => Boolean(value && typeof value === "object" && "response" in value),
}));

vi.mock("@/lib/library/domain", () => ({
  saveArtifactBackToLibrary: mocks.saveArtifactBackToLibrary,
}));

import { POST } from "./route";

describe("POST /api/library/artifacts/[id]/save-back", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveArtifactBackToLibrary.mockResolvedValue({
      item: { id: "ctx-1", title: "Artifact" },
    });
  });

  it("saves artifact outputs back into the Library", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/library/artifacts/art-1/save-back", {
        method: "POST",
        body: JSON.stringify({ stackIds: ["stack-1"], tags: ["artifact"], reason: "manual" }),
      }),
      { params: Promise.resolve({ id: "art-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.saveArtifactBackToLibrary).toHaveBeenCalledWith(expect.anything(), {
      orgId: "org-1",
      userId: "user-1",
      artifactId: "art-1",
      stackIds: ["stack-1"],
      tags: ["artifact"],
      reason: "manual",
    });
  });
});
