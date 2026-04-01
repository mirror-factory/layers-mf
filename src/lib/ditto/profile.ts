import { generateObject } from "ai";
import { z } from "zod";
import { extractionModel } from "@/lib/ai/config";
import { logUsage } from "@/lib/ai/usage";
import { createAdminClient } from "@/lib/supabase/server";

export const DittoProfileSchema = z.object({
  interests: z
    .array(z.string())
    .describe("Top 5-10 topics the user engages with most"),
  preferred_sources: z
    .record(z.string(), z.number())
    .describe("Source preference scores 0-1 based on click patterns"),
  communication_style: z.enum(["formal", "casual", "balanced"]),
  detail_level: z.enum(["brief", "moderate", "detailed"]),
  priority_topics: z
    .array(z.string())
    .describe("Top 3-5 topics by recent engagement"),
  working_hours: z.object({ start: z.number(), end: z.number() }),
});

export type DittoProfile = z.infer<typeof DittoProfileSchema>;

export const DEFAULT_PROFILE: DittoProfile = {
  interests: [],
  preferred_sources: {},
  communication_style: "balanced",
  detail_level: "moderate",
  priority_topics: [],
  working_hours: { start: 9, end: 17 },
};

/**
 * Generate/update a Ditto profile from user interactions.
 */
export async function generateDittoProfile(
  userId: string,
  orgId: string
): Promise<DittoProfile> {
  const supabase = createAdminClient();

  // Fetch last 200 interactions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: interactions } = await (supabase as any)
    .from("user_interactions")
    .select(
      "interaction_type, resource_type, query, source_type, content_type, metadata, created_at"
    )
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);

  const interactionCount = interactions?.length ?? 0;

  // Not enough data — return defaults
  if (!interactions || interactionCount < 3) {
    await upsertProfile(supabase, userId, orgId, DEFAULT_PROFILE, interactionCount);
    return DEFAULT_PROFILE;
  }

  // Aggregate signals
  const sourceCounts: Record<string, number> = {};
  const contentTypeCounts: Record<string, number> = {};
  const queries: string[] = [];
  const hours: number[] = [];

  for (const ix of interactions) {
    if (ix.source_type) {
      sourceCounts[ix.source_type] = (sourceCounts[ix.source_type] ?? 0) + 1;
    }
    if (ix.content_type) {
      contentTypeCounts[ix.content_type] =
        (contentTypeCounts[ix.content_type] ?? 0) + 1;
    }
    if (ix.query) {
      queries.push(ix.query);
    }
    const hour = new Date(ix.created_at).getUTCHours();
    hours.push(hour);
  }

  // Normalise source scores to 0-1
  const maxSource = Math.max(...Object.values(sourceCounts), 1);
  const sourceScores: Record<string, number> = {};
  for (const [src, count] of Object.entries(sourceCounts)) {
    sourceScores[src] = Math.round((count / maxSource) * 100) / 100;
  }

  // Calculate working hours from distribution
  const sortedHours = [...hours].sort((a, b) => a - b);
  const startHour = sortedHours[Math.floor(sortedHours.length * 0.1)] ?? 9;
  const endHour = sortedHours[Math.floor(sortedHours.length * 0.9)] ?? 17;

  const aggregation = {
    totalInteractions: interactionCount,
    sourceCounts,
    contentTypeCounts,
    recentQueries: queries.slice(0, 30),
    estimatedWorkingHours: { start: startHour, end: endHour },
  };

  // Use AI to synthesize profile
  const result = await generateObject({
    model: extractionModel,
    schema: DittoProfileSchema,
    prompt: `You are analyzing a user's interaction patterns to build their personalization profile.

Aggregated data from ${interactionCount} recent interactions:

Source usage (how often they interact with each source):
${JSON.stringify(sourceCounts, null, 2)}

Content types they engage with:
${JSON.stringify(contentTypeCounts, null, 2)}

Recent search queries and chat questions:
${queries.slice(0, 30).map((q) => `- "${q}"`).join("\n")}

Estimated active hours (UTC): ${startHour}:00 - ${endHour}:00

Based on these patterns, determine:
1. Their top interests/topics (from queries and content types)
2. Source preference scores (0-1, normalized)
3. Communication style preference (formal/casual/balanced — infer from query style)
4. Detail level preference (brief/moderate/detailed — infer from query complexity)
5. Priority topics (what they search for most)
6. Working hours (start/end integers, 24h format)`,
  });

  logUsage({
    orgId,
    userId,
    operation: "ditto_profile_generation",
    model: "anthropic/claude-haiku-4-5-20251001",
    inputTokens: result.usage?.inputTokens,
    outputTokens: result.usage?.outputTokens,
  });

  const profile = result.object;

  await upsertProfile(supabase, userId, orgId, profile, interactionCount);

  return profile;
}

async function upsertProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  orgId: string,
  profile: DittoProfile,
  interactionCount: number
) {
  const confidence = Math.min(interactionCount / 200, 1.0);

  await supabase.from("ditto_profiles").upsert(
    {
      user_id: userId,
      org_id: orgId,
      interests: profile.interests,
      preferred_sources: profile.preferred_sources,
      communication_style: profile.communication_style,
      detail_level: profile.detail_level,
      priority_topics: profile.priority_topics,
      working_hours: profile.working_hours,
      interaction_count: interactionCount,
      confidence,
      last_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,org_id" }
  );
}
