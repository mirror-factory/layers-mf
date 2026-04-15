import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock logArtifactInteraction
const mockLogArtifactInteraction = vi.fn();
vi.mock("@/lib/interactions/artifact-tracker", () => ({
  logArtifactInteraction: (...args: unknown[]) => mockLogArtifactInteraction(...args),
}));

// Mock createArtifact / createVersion
const mockCreateArtifact = vi.fn();
const mockCreateVersion = vi.fn();
vi.mock("@/lib/artifacts", () => ({
  createArtifact: (...args: unknown[]) => mockCreateArtifact(...args),
  createVersion: (...args: unknown[]) => mockCreateVersion(...args),
}));

// Mock search modules
vi.mock("@/lib/db/search", () => ({
  searchContext: vi.fn().mockResolvedValue([]),
  searchContextChunks: vi.fn().mockResolvedValue([]),
}));

// Mock sandbox execute
vi.mock("@/lib/sandbox/execute", () => ({
  executeProject: vi.fn().mockResolvedValue({
    stdout: "ok",
    stderr: "",
    exitCode: 0,
    previewUrl: "https://preview.test",
    sandboxId: "sb-1",
    snapshotId: "snap-1",
    outputFiles: {},
  }),
}));

// Mock cron
vi.mock("@/lib/cron", () => ({
  calculateNextCron: vi.fn(),
}));

import { createTools } from "../tools";

function createMockSupabase() {
  const mockSingle = vi.fn();
  const mockEqInner = vi.fn().mockReturnValue({ single: mockSingle });
  const mockEqOuter = vi.fn().mockReturnValue({ eq: mockEqInner });
  const mockSelect = vi.fn().mockReturnValue({
    eq: mockEqOuter,
    in: vi.fn().mockResolvedValue({ data: [] }),
  });
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });

  return {
    from: vi.fn().mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
      insert: mockInsert,
      order: mockOrder,
    }),
    rpc: vi.fn(),
    _mockSingle: mockSingle,
    _mockSelect: mockSelect,
    _mockUpdate: mockUpdate,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const toolCallOptions = {
  toolCallId: "tc-1",
  messages: [],
  abortSignal: new AbortController().signal,
};

describe("tool interaction tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("write_code", () => {
    it("logs 'created' interaction with title, type, and language", async () => {
      mockCreateArtifact.mockResolvedValue({ artifactId: "art-write-1" });
      const tools = createTools(createMockSupabase(), "org-1", "user-1");

      await tools.write_code.execute!(
        {
          filename: "setup.sh",
          language: "bash",
          code: "#!/bin/bash\necho hello",
          description: "Setup script",
        },
        toolCallOptions,
      );

      expect(mockLogArtifactInteraction).toHaveBeenCalledWith({
        artifactId: "art-write-1",
        userId: "user-1",
        type: "created",
        metadata: { title: "setup.sh", type: "code", language: "bash" },
      });
    });

    it("does not log when userId is not provided", async () => {
      mockCreateArtifact.mockResolvedValue({ artifactId: "art-write-2" });
      const tools = createTools(createMockSupabase(), "org-1");

      await tools.write_code.execute!(
        {
          filename: "test.py",
          language: "python",
          code: "print('hi')",
        },
        toolCallOptions,
      );

      expect(mockLogArtifactInteraction).not.toHaveBeenCalled();
    });

    it("does not log when createArtifact returns no artifactId", async () => {
      mockCreateArtifact.mockResolvedValue({ error: "failed" });
      const tools = createTools(createMockSupabase(), "org-1", "user-1");

      await tools.write_code.execute!(
        {
          filename: "bad.ts",
          language: "typescript",
          code: "const x = 1;",
        },
        toolCallOptions,
      );

      expect(mockLogArtifactInteraction).not.toHaveBeenCalled();
    });
  });

  describe("edit_code", () => {
    it("logs 'edited' interaction with version info, diff_size, and chatContext", async () => {
      const supabase = createMockSupabase();
      // Mock artifact lookup
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "art-edit-1",
                  title: "App.tsx",
                  content: "const old = true;",
                  language: "typescript",
                  current_version: 2,
                  type: "code",
                  preview_url: null,
                  snapshot_id: null,
                  run_command: null,
                  expose_port: null,
                },
                error: null,
              }),
            }),
          }),
          in: vi.fn().mockResolvedValue({ data: [] }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
      mockCreateVersion.mockResolvedValue({ versionNumber: 3 });

      const tools = createTools(supabase, "org-1", "user-1");

      await tools.edit_code.execute!(
        {
          artifactId: "art-edit-1",
          targetText: "const old = true;",
          replacement: "const updated = false;",
          editDescription: "Fix boolean value",
        },
        toolCallOptions,
      );

      expect(mockLogArtifactInteraction).toHaveBeenCalledWith({
        artifactId: "art-edit-1",
        userId: "user-1",
        type: "edited",
        metadata: {
          version_from: 2,
          version_to: 3,
          diff_size: expect.any(Number),
        },
        chatContext: "Fix boolean value",
        versionNumber: 3,
      });
    });
  });

  describe("artifact_get", () => {
    it("logs 'ai_read' interaction with model metadata", async () => {
      const supabase = createMockSupabase();
      supabase.from.mockImplementation((table: string) => {
        if (table === "artifacts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "art-get-1",
                      title: "Doc",
                      content: "Hello",
                      language: "text",
                      current_version: 1,
                      type: "code",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "artifact_interactions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [] }),
                }),
              }),
            }),
          };
        }
        if (table === "artifact_files") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          };
        }
        if (table === "artifact_versions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 1 }),
            }),
          };
        }
        return { select: vi.fn().mockReturnValue({ eq: vi.fn() }) };
      });

      const tools = createTools(supabase, "org-1", "user-1");

      await tools.artifact_get.execute!(
        { artifactId: "art-get-1" },
        toolCallOptions,
      );

      expect(mockLogArtifactInteraction).toHaveBeenCalledWith({
        artifactId: "art-get-1",
        userId: "user-1",
        type: "ai_read",
        metadata: { model: "tool_invocation" },
      });
    });
  });

  describe("artifact_delete", () => {
    it("logs 'deleted' interaction", async () => {
      const supabase = createMockSupabase();
      supabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      const tools = createTools(supabase, "org-1", "user-1");

      await tools.artifact_delete.execute!(
        { artifactId: "art-del-1" },
        toolCallOptions,
      );

      expect(mockLogArtifactInteraction).toHaveBeenCalledWith({
        artifactId: "art-del-1",
        userId: "user-1",
        type: "deleted",
      });
    });

    it("does not log when delete fails", async () => {
      const supabase = createMockSupabase();
      supabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: { message: "db error" } }),
          }),
        }),
      });

      const tools = createTools(supabase, "org-1", "user-1");

      await tools.artifact_delete.execute!(
        { artifactId: "art-del-2" },
        toolCallOptions,
      );

      expect(mockLogArtifactInteraction).not.toHaveBeenCalled();
    });
  });

  describe("artifact_version (restore)", () => {
    it("logs 'restored' interaction with restored_to_version", async () => {
      const supabase = createMockSupabase();
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { content: "restored content" },
                error: null,
              }),
            }),
          }),
        }),
      });
      mockCreateVersion.mockResolvedValue({ versionNumber: 4 });

      const tools = createTools(supabase, "org-1", "user-1");

      await tools.artifact_version.execute!(
        { artifactId: "art-ver-1", action: "restore", versionNumber: 2 },
        toolCallOptions,
      );

      expect(mockLogArtifactInteraction).toHaveBeenCalledWith({
        artifactId: "art-ver-1",
        userId: "user-1",
        type: "restored",
        metadata: { restored_to_version: 2 },
        versionNumber: 2,
      });
    });

    it("does not log for list action", async () => {
      const supabase = createMockSupabase();
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const tools = createTools(supabase, "org-1", "user-1");

      await tools.artifact_version.execute!(
        { artifactId: "art-ver-2", action: "list" },
        toolCallOptions,
      );

      expect(mockLogArtifactInteraction).not.toHaveBeenCalled();
    });
  });

  describe("run_project", () => {
    it("logs 'created' then 'sandbox_executed' interactions", async () => {
      mockCreateArtifact.mockResolvedValue({ artifactId: "art-run-1" });

      const tools = createTools(createMockSupabase(), "org-1", "user-1");

      await tools.run_project.execute!(
        {
          files: [{ path: "main.py", content: "print('hello')" }],
          run_command: "python main.py",
          template: "python" as const,
        },
        toolCallOptions,
      );

      expect(mockLogArtifactInteraction).toHaveBeenCalledTimes(2);

      expect(mockLogArtifactInteraction).toHaveBeenCalledWith({
        artifactId: "art-run-1",
        userId: "user-1",
        type: "created",
        metadata: {
          title: expect.any(String),
          type: "sandbox",
          language: "javascript",
        },
      });

      expect(mockLogArtifactInteraction).toHaveBeenCalledWith({
        artifactId: "art-run-1",
        userId: "user-1",
        type: "sandbox_executed",
        metadata: { exit_code: 0 },
      });
    });

    it("does not log when userId is not provided", async () => {
      mockCreateArtifact.mockResolvedValue({ artifactId: "art-run-2" });

      const tools = createTools(createMockSupabase(), "org-1");

      await tools.run_project.execute!(
        {
          files: [{ path: "main.py", content: "print('hello')" }],
          run_command: "python main.py",
          template: "python" as const,
        },
        toolCallOptions,
      );

      expect(mockLogArtifactInteraction).not.toHaveBeenCalled();
    });
  });
});
