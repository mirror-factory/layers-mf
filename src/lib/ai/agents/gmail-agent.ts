import { generateText } from "ai";
import { tool } from "ai";
import { z } from "zod";
import { gateway, TASK_MODELS } from "@/lib/ai/config";
import type { GmailClient } from "@/lib/api";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

const GMAIL_SYSTEM = `You are a Gmail specialist within Granger.
You can search emails, read threads, and draft replies.
Use Gmail search syntax: from:, to:, subject:, newer_than:, is:unread, has:attachment.
Format email results with Subject, From, Date, and a snippet.`;

export function createGmailTools(
  client: GmailClient,
  orgId: string,
  supabase: AnySupabase,
) {
  return {
    search_emails: tool({
      description: "Search emails with Gmail query syntax",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "Gmail search: 'from:john', 'is:unread newer_than:7d'",
          ),
        limit: z.number().optional(),
      }),
      execute: async (input) => {
        const emails = await client.searchEmails(
          input.query,
          input.limit ?? 10,
        );
        return {
          emails: emails.map((e) => ({
            id: e.id,
            subject: e.subject,
            from: e.from,
            date: e.date,
            snippet: e.snippet,
          })),
        };
      },
    }),

    read_email: tool({
      description: "Read the full content of a specific email by ID",
      inputSchema: z.object({
        id: z.string().describe("The email message ID"),
      }),
      execute: async ({ id }) => {
        const msg = await client.getMessage(id);
        if (!msg) return { error: "Email not found" };
        return {
          id: msg.id,
          subject: msg.subject,
          from: msg.from,
          to: msg.to,
          date: msg.date,
          body: msg.body,
        };
      },
    }),

    draft_email: tool({
      description:
        "Create a draft email. Routes through approval queue.",
      inputSchema: z.object({
        to: z.string(),
        subject: z.string(),
        body: z.string(),
      }),
      execute: async (input) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("approval_queue")
          .insert({
            org_id: orgId,
            requested_by_agent: "granger:gmail",
            action_type: "draft_email",
            target_service: "gmail",
            payload: input,
            status: "pending",
            reasoning: `Draft email to ${input.to}: "${input.subject}"`,
          })
          .select("id")
          .single();
        if (error) return { error: error.message };
        return {
          message: "Draft proposed. Waiting for approval.",
          approval_id: data.id,
        };
      },
    }),
  };
}

export async function runGmailAgent(
  query: string,
  client: GmailClient,
  orgId: string,
  supabase: AnySupabase,
) {
  const tools = createGmailTools(client, orgId, supabase);
  const { text, steps } = await generateText({
    model: gateway(TASK_MODELS.chat),
    system: GMAIL_SYSTEM,
    prompt: query,
    tools,
    maxSteps: 4,
  });
  return {
    text,
    toolCalls: steps.flatMap((s) => s.toolCalls ?? []),
  };
}
