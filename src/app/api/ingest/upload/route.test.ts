import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockFrom, mockParseFile, mockInngestSend } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockParseFile: vi.fn(),
    mockInngestSend: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

vi.mock("@/lib/ingest/parse", () => ({
  parseFile: mockParseFile,
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: mockInngestSend },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockReturnValue({ success: true }),
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

function makeUploadRequest(file?: File): NextRequest {
  const formData = new FormData();
  if (file) formData.append("file", file);
  const req = new NextRequest("http://localhost:3000/api/ingest/upload", {
    method: "POST",
    body: formData,
  });
  // Preserve original FormData to avoid File→Blob downgrade during serialization
  req.formData = async () => formData;
  return req;
}

function mockAuthenticated(orgId = "org-1") {
  mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
  mockFrom.mockImplementation((table: string) => {
    if (table === "org_members") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { org_id: orgId } }),
          }),
        }),
      };
    }
    if (table === "context_items") {
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "ci-1" },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    return {};
  });
}


describe("POST /api/ingest/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });

    const file = new File(["hello"], "test.txt", { type: "text/plain" });
    const res = await POST(makeUploadRequest(file));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when user has no organization", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const file = new File(["hello"], "test.txt", { type: "text/plain" });
    const res = await POST(makeUploadRequest(file));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No organization found");
  });

  it("returns 400 when no file is provided", async () => {
    mockAuthenticated();
    const res = await POST(makeUploadRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No file provided");
  });

  it("returns 413 when file exceeds 10MB", async () => {
    mockAuthenticated();
    const bigContent = new Uint8Array(10 * 1024 * 1024 + 1);
    const file = new File([bigContent], "big.txt", { type: "text/plain" });
    const res = await POST(makeUploadRequest(file));
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("File too large (max 10MB)");
  });

  it("returns 422 when file parsing fails", async () => {
    mockAuthenticated();
    mockParseFile.mockRejectedValue(new Error("Unsupported format"));

    const file = new File(["data"], "test.xyz", { type: "application/octet-stream" });
    const res = await POST(makeUploadRequest(file));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Unsupported format");
  });

  it("returns 202 with status accepted on successful upload", async () => {
    mockAuthenticated();
    mockParseFile.mockResolvedValue({ text: "parsed content", contentType: "document" });

    const file = new File(["hello world"], "report.txt", { type: "text/plain" });
    const res = await POST(makeUploadRequest(file));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toEqual({ id: "ci-1", status: "accepted" });
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: "context/item.created",
      data: { contextItemId: "ci-1", orgId: "org-1" },
    });
  });

  it("inserts context_item with correct fields", async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "ci-1" }, error: null }),
      }),
    });
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { org_id: "org-1" } }),
            }),
          }),
        };
      }
      if (table === "context_items") {
        return { insert: insertMock, update: updateMock };
      }
      return {};
    });

    mockParseFile.mockResolvedValue({ text: "meeting notes content", contentType: "meeting_transcript" });

    const file = new File(["meeting notes"], "meeting.txt", { type: "text/plain" });
    await POST(makeUploadRequest(file));

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: "org-1",
        source_type: "upload",
        title: "meeting.txt",
        raw_content: "meeting notes content",
        content_type: "meeting_transcript",
        status: "pending",
      })
    );
  });
});
