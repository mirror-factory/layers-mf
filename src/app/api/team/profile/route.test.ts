import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockUpdateUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpdateUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: mockGetUser,
      updateUser: mockUpdateUser,
    },
  }),
}));

import { GET, PATCH } from "./route";
import { NextRequest } from "next/server";

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/team/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const mockUser = {
  id: "u-1",
  email: "user@test.com",
  user_metadata: { display_name: "Test User" },
};

describe("GET /api/team/profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns user profile with display name", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe("user@test.com");
    expect(body.displayName).toBe("Test User");
  });

  it("returns empty display name when not set", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { ...mockUser, user_metadata: {} } },
      error: null,
    });
    const res = await GET();
    const body = await res.json();
    expect(body.displayName).toBe("");
  });
});

describe("PATCH /api/team/profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const res = await PATCH(makePatchRequest({ displayName: "New" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no fields provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    const res = await PATCH(makePatchRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password too short", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    const res = await PATCH(makePatchRequest({ password: "short" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when display name empty", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    const res = await PATCH(makePatchRequest({ displayName: "" }));
    expect(res.status).toBe(400);
  });

  it("updates display name successfully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
    const res = await PATCH(makePatchRequest({ displayName: "New Name" }));
    expect(res.status).toBe(200);
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { display_name: "New Name" },
    });
  });

  it("updates password successfully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
    const res = await PATCH(makePatchRequest({ password: "newsecurepassword" }));
    expect(res.status).toBe(200);
    expect(mockUpdateUser).toHaveBeenCalledWith({
      password: "newsecurepassword",
    });
  });

  it("updates both display name and password", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
    const res = await PATCH(
      makePatchRequest({ displayName: "Updated", password: "newpassword1" })
    );
    expect(res.status).toBe(200);
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { display_name: "Updated" },
      password: "newpassword1",
    });
  });

  it("returns 500 when auth update fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockUpdateUser.mockResolvedValue({ error: { message: "Auth error" } });
    const res = await PATCH(makePatchRequest({ displayName: "New" }));
    expect(res.status).toBe(500);
  });

  it("returns 400 when display name exceeds max length", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    const res = await PATCH(makePatchRequest({ displayName: "a".repeat(101) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password exceeds max length", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    const res = await PATCH(makePatchRequest({ password: "a".repeat(129) }));
    expect(res.status).toBe(400);
  });

  it("accepts display name at max length boundary", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
    const res = await PATCH(makePatchRequest({ displayName: "a".repeat(100) }));
    expect(res.status).toBe(200);
  });

  it("accepts password at min length boundary", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
    const res = await PATCH(makePatchRequest({ password: "a".repeat(8) }));
    expect(res.status).toBe(200);
  });

  it("returns user profile with null user_metadata", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { ...mockUser, user_metadata: null } },
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.displayName).toBe("");
  });
});
