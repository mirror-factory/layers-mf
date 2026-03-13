import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockNangoProxy, mockAdminFrom } = vi.hoisted(() => ({
  mockNangoProxy: vi.fn(),
  mockAdminFrom: vi.fn(),
}));

vi.mock("@/lib/nango/client", () => ({
  nango: { proxy: mockNangoProxy },
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
}));

import {
  fetchDriveChanges,
  registerDriveWatch,
  unregisterDriveWatch,
  type DriveChangedFile,
} from "./google-drive";

// ── fetchDriveChanges ────────────────────────────────────────────────────────

describe("fetchDriveChanges", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches changed files from Drive API", async () => {
    mockNangoProxy.mockResolvedValueOnce({
      data: {
        changes: [
          {
            fileId: "f-1",
            removed: false,
            file: {
              id: "f-1",
              name: "Meeting Notes",
              mimeType: "application/vnd.google-apps.document",
              createdTime: "2026-01-01",
              modifiedTime: "2026-03-01",
              webViewLink: "https://docs.google.com/document/d/f-1",
            },
          },
        ],
        newStartPageToken: "token-2",
      },
    });

    const result = await fetchDriveChanges("conn-1", "google-drive", "token-1");
    expect(result.files).toHaveLength(1);
    expect(result.files[0].name).toBe("Meeting Notes");
    expect(result.newStartPageToken).toBe("token-2");
  });

  it("skips removed files", async () => {
    mockNangoProxy.mockResolvedValueOnce({
      data: {
        changes: [
          { fileId: "f-1", removed: true },
          {
            fileId: "f-2",
            removed: false,
            file: {
              id: "f-2",
              name: "Active Doc",
              mimeType: "application/vnd.google-apps.document",
            },
          },
        ],
        newStartPageToken: "token-2",
      },
    });

    const result = await fetchDriveChanges("conn-1", "google-drive", "token-1");
    expect(result.files).toHaveLength(1);
    expect(result.files[0].name).toBe("Active Doc");
  });

  it("skips changes without file data", async () => {
    mockNangoProxy.mockResolvedValueOnce({
      data: {
        changes: [{ fileId: "f-1", removed: false }], // no file property
        newStartPageToken: "token-2",
      },
    });

    const result = await fetchDriveChanges("conn-1", "google-drive", "token-1");
    expect(result.files).toHaveLength(0);
  });

  it("paginates through multiple pages", async () => {
    mockNangoProxy
      .mockResolvedValueOnce({
        data: {
          changes: [
            {
              fileId: "f-1",
              removed: false,
              file: { id: "f-1", name: "Doc 1", mimeType: "text/plain" },
            },
          ],
          nextPageToken: "page-2",
        },
      })
      .mockResolvedValueOnce({
        data: {
          changes: [
            {
              fileId: "f-2",
              removed: false,
              file: { id: "f-2", name: "Doc 2", mimeType: "text/plain" },
            },
          ],
          newStartPageToken: "token-final",
        },
      });

    const result = await fetchDriveChanges("conn-1", "google-drive", "token-1");
    expect(result.files).toHaveLength(2);
    expect(result.newStartPageToken).toBe("token-final");
    expect(mockNangoProxy).toHaveBeenCalledTimes(2);
  });

  it("returns empty files when no changes exist", async () => {
    mockNangoProxy.mockResolvedValueOnce({
      data: {
        changes: [],
        newStartPageToken: "token-same",
      },
    });

    const result = await fetchDriveChanges("conn-1", "google-drive", "token-1");
    expect(result.files).toHaveLength(0);
    expect(result.newStartPageToken).toBe("token-same");
  });

  it("handles null changes array", async () => {
    mockNangoProxy.mockResolvedValueOnce({
      data: {
        newStartPageToken: "token-2",
      },
    });

    const result = await fetchDriveChanges("conn-1", "google-drive", "token-1");
    expect(result.files).toHaveLength(0);
  });

  it("includes file metadata (lastModifyingUser, size)", async () => {
    mockNangoProxy.mockResolvedValueOnce({
      data: {
        changes: [
          {
            fileId: "f-1",
            removed: false,
            file: {
              id: "f-1",
              name: "Spreadsheet",
              mimeType: "application/vnd.google-apps.spreadsheet",
              size: "1024",
              lastModifyingUser: {
                displayName: "Alice",
                emailAddress: "alice@example.com",
              },
            },
          },
        ],
        newStartPageToken: "token-2",
      },
    });

    const result = await fetchDriveChanges("conn-1", "google-drive", "token-1");
    expect(result.files[0].lastModifyingUser?.displayName).toBe("Alice");
    expect(result.files[0].size).toBe("1024");
  });
});

// ── registerDriveWatch ───────────────────────────────────────────────────────

describe("registerDriveWatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registers a watch channel and stores metadata", async () => {
    // getStartPageToken
    mockNangoProxy
      .mockResolvedValueOnce({
        data: { startPageToken: "spt-1" },
      })
      // watch endpoint
      .mockResolvedValueOnce({
        data: {
          id: "watch-channel-id",
          resourceId: "res-1",
          expiration: String(Date.now() + 86400000),
        },
      });

    mockAdminFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const result = await registerDriveWatch("conn-1", "google-drive", "org-1");
    expect(result).not.toBeNull();
    expect(result!.channelId).toBe("watch-channel-id");
    expect(result!.resourceId).toBe("res-1");
  });

  it("returns null when startPageToken fetch fails", async () => {
    mockNangoProxy.mockRejectedValueOnce(new Error("API error"));
    const result = await registerDriveWatch("conn-1", "google-drive", "org-1");
    expect(result).toBeNull();
  });

  it("returns null when watch registration fails", async () => {
    mockNangoProxy
      .mockResolvedValueOnce({ data: { startPageToken: "spt-1" } })
      .mockRejectedValueOnce(new Error("Watch failed"));

    const result = await registerDriveWatch("conn-1", "google-drive", "org-1");
    expect(result).toBeNull();
  });
});

// ── unregisterDriveWatch ─────────────────────────────────────────────────────

describe("unregisterDriveWatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stops a watch channel successfully", async () => {
    mockNangoProxy.mockResolvedValueOnce({ data: {} });
    const result = await unregisterDriveWatch("ch-1", "res-1", "conn-1", "google-drive");
    expect(result).toBe(true);
    expect(mockNangoProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/drive/v3/channels/stop",
        data: { id: "ch-1", resourceId: "res-1" },
      })
    );
  });

  it("returns false on error", async () => {
    mockNangoProxy.mockRejectedValueOnce(new Error("Stop failed"));
    const result = await unregisterDriveWatch("ch-1", "res-1", "conn-1", "google-drive");
    expect(result).toBe(false);
  });
});
