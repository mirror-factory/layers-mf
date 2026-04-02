import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/generate
 * Lightweight AI text generation endpoint for inline HTML tools.
 * Accepts a prompt, returns generated text. Uses Haiku for speed.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const prompt = body.prompt as string;
  const system = body.system as string | undefined;
  const maxTokens = Math.min(body.maxTokens ?? 500, 2000);

  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  try {
    const { text } = await generateText({
      model: gateway("anthropic/claude-haiku-4-5-20251001"),
      prompt,
      system,
      maxOutputTokens: maxTokens,
    });

    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
