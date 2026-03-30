import { generateText, stepCountIs } from "ai";
import { tool } from "ai";
import { z } from "zod";
import { gateway, TASK_MODELS } from "@/lib/ai/config";
import type { DriveClient } from "@/lib/api";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

const DRIVE_SYSTEM = `You are a Google Drive specialist within Granger.
You can search files, list documents, and read file contents from Google Drive.
You understand Google Workspace file types: Docs, Sheets, Slides, and binary files.
Format results with file name, type, last modified date, and a link when available.`;

export function createDriveTools(
  client: DriveClient,
  _orgId: string,
  _supabase: AnySupabase,
) {
  return {
    search_files: tool({
      description:
        "Search Google Drive files by name or content",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe("Search query for file names"),
        limit: z
          .number()
          .optional()
          .describe("Max results, default 20"),
      }),
      execute: async (input) => {
        const files = await client.listFiles(
          input.query,
          input.limit ?? 20,
        );
        return {
          files: files.map((f) => ({
            id: f.id,
            name: f.name,
            type: f.mimeType,
            modified: f.modifiedTime,
          })),
        };
      },
    }),

    read_file: tool({
      description:
        "Read the content of a Google Workspace file (Doc, Sheet, Slides) by ID",
      inputSchema: z.object({
        id: z.string().describe("The Drive file ID"),
        mimeType: z
          .string()
          .describe(
            "The file MIME type (e.g. application/vnd.google-apps.document)",
          ),
      }),
      execute: async ({ id, mimeType }) => {
        try {
          const content = await client.exportFile(id, mimeType);
          return { content: content.slice(0, 8000) };
        } catch {
          return { error: "Cannot export this file type" };
        }
      },
    }),
  };
}

export async function runDriveAgent(
  query: string,
  client: DriveClient,
  orgId: string,
  supabase: AnySupabase,
) {
  const tools = createDriveTools(client, orgId, supabase);
  const { text, steps } = await generateText({
    model: gateway(TASK_MODELS.chat),
    system: DRIVE_SYSTEM,
    prompt: query,
    tools,
    stopWhen: stepCountIs(4),
  });
  return {
    text,
    toolCalls: steps.flatMap((s) => s.toolCalls ?? []),
  };
}
