import { NextRequest } from "next/server";
import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient } from "@/lib/supabase/server";
import { createTools } from "@/lib/ai/tools";

export const maxDuration = 60;

const SKILLS_SYSTEM_PROMPT = `You help users create and manage AI skills. You can create custom skills with system prompts, search the skills marketplace for pre-built skills, and activate skills for use in chat. A skill is a reusable prompt template that gives the AI specialized behavior for specific tasks.

When the user asks to find skills:
1. Use search_skills_marketplace to find matching skills
2. Present the options clearly with name, description, and source

When the user asks to create a skill:
1. Use create_skill with the details they provide
2. Confirm the skill was created successfully

When the user asks to activate a skill, use activate_skill.
When the user asks to create a custom tool, use create_tool_from_code.

Be concise and helpful. Focus only on skills management.`;

const MODEL_ID = "google/gemini-3-flash";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return new Response("No organization found", { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return new Response("Invalid messages", { status: 400 });
  }

  const uiMessages: UIMessage[] = body.messages;

  if (uiMessages.length === 0) {
    return new Response("Invalid messages", { status: 400 });
  }

  const orgId = member.org_id;
  const allTools = createTools(supabase, orgId, user.id);

  // Only expose skills-related tools
  const skillsTools = {
    activate_skill: allTools.activate_skill,
    create_skill: allTools.create_skill,
    create_tool_from_code: allTools.create_tool_from_code,
    search_skills_marketplace: allTools.search_skills_marketplace,
  };

  const modelMessages = await convertToModelMessages(uiMessages);

  const result = streamText({
    model: gateway(MODEL_ID),
    system: SKILLS_SYSTEM_PROMPT + `\n\nCurrent date/time: ${new Date().toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" })}.`,
    messages: modelMessages,
    tools: skillsTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
