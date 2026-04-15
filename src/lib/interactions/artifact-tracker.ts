import { createAdminClient } from "@/lib/supabase/server";

type InteractionType =
  | "created" | "viewed" | "edited" | "shared" | "opened_by_recipient"
  | "sandbox_executed" | "ai_read" | "ai_modified" | "forked"
  | "restored" | "deleted" | "tagged" | "commented";

interface LogInteractionParams {
  artifactId: string;
  userId: string;
  type: InteractionType;
  metadata?: Record<string, unknown>;
  chatContext?: string;
  conversationId?: string;
  versionNumber?: number;
}

export async function logArtifactInteraction(params: LogInteractionParams) {
  try {
    const supabase = createAdminClient();
    await (supabase as any).from("artifact_interactions").insert({
      artifact_id: params.artifactId,
      user_id: params.userId,
      interaction_type: params.type,
      metadata: params.metadata ?? {},
      chat_context: params.chatContext,
      conversation_id: params.conversationId,
      version_number: params.versionNumber,
    });
  } catch {
    // Never let interaction tracking break the main flow
  }
}
