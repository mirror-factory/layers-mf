import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { gateway } from "@/lib/ai/config";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { selectedText, prompt, fullContext } = body as {
    selectedText?: string;
    prompt?: string;
    fullContext?: string;
  };

  if (!selectedText?.trim() || !prompt?.trim()) {
    return NextResponse.json(
      { error: "selectedText and prompt are required" },
      { status: 400 },
    );
  }

  try {
    const result = await generateText({
      model: gateway("google/gemini-3.1-flash-lite-preview"),
      system: `You are an inline text editor. The user will give you a text selection and an editing instruction.
Return ONLY the replacement text — no explanation, no markdown fences, no quotes, no preamble.
Match the original formatting style (e.g., if it was a list, return a list).
If the instruction is unclear, make your best interpretation and apply it.`,
      prompt: `## Selected text
${selectedText}

## Editing instruction
${prompt}

${fullContext ? `## Surrounding context (for reference only)\n${fullContext.slice(0, 1500)}` : ""}

Return ONLY the replacement text:`,
    });

    return NextResponse.json({ replacement: result.text.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
