import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 500 });
  }

  let body: { text: string; voice_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.text || body.text.length > 2000) {
    return NextResponse.json({ error: "Text required (max 2000 chars)" }, { status: 400 });
  }

  try {
    const response = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "Cartesia-Version": "2024-06-10",
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: "sonic-turbo", // 40ms first byte (vs 90ms for sonic-2)
        transcript: body.text,
        voice: {
          mode: "id",
          id: body.voice_id || "e4d5f4c4-6601-4779-bee1-b3c14d629dc6", // Jillian - Happy Spirit (cheerful, upbeat)
        },
        output_format: {
          container: "mp3",
          bit_rate: 128000,
          sample_rate: 44100,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Cartesia TTS error:", errorText);
      return NextResponse.json({ error: "TTS generation failed" }, { status: 502 });
    }

    // Stream the response body instead of buffering the full MP3
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("Cartesia TTS error:", err);
    return NextResponse.json({ error: "TTS failed" }, { status: 500 });
  }
}
