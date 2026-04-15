import { generateObject } from "ai";
import { gateway } from "@/lib/ai/config";
import { z } from "zod";
import type { AmbientAISuggestion } from "@/components/ambient-ai-card";

const AMBIENT_MODEL = "google/gemini-3.1-flash-lite-preview";

interface AmbientCheckParams {
  recentMessages: { role: string; text: string }[];
  orgId: string;
  conversationId: string;
}

export async function checkForAmbientSuggestion(
  params: AmbientCheckParams
): Promise<AmbientAISuggestion | null> {
  // Only check if there are 2+ messages from different roles
  const roles = new Set(params.recentMessages.map((m) => m.role));
  if (params.recentMessages.length < 2 || roles.size < 2) {
    return null;
  }

  const transcript = params.recentMessages
    .slice(-5)
    .map((m) => `${m.role}: ${m.text}`)
    .join("\n");

  const { object } = await generateObject({
    model: gateway(AMBIENT_MODEL),
    schema: z.object({
      should_suggest: z.boolean(),
      suggestion_type: z
        .enum(["info", "action", "question"])
        .optional(),
      title: z.string().optional(),
      body: z.string().optional(),
    }),
    prompt: `You're monitoring a team conversation. Based on the last few messages, decide if you should proactively offer helpful information, suggest an action, or ask a clarifying question. Only suggest if it would genuinely help — don't be annoying.

Conversation:
${transcript}

Should you proactively offer something?`,
  });

  if (!object.should_suggest || !object.title) return null;

  return {
    id: crypto.randomUUID(),
    type: object.suggestion_type || "info",
    title: object.title,
    body: object.body || "",
    actions: ["accept", "dismiss", "modify"],
  };
}
