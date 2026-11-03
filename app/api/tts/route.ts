import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text, voice = "alloy" } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server TTS not configured; falling back to browser speech", fallback: true },
        { status: 503 }
      );
    }

    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text.slice(0, 4096),
        voice,
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `TTS error (${res.status}): ${err}`, fallback: true },
        { status: res.status }
      );
    }

    return new NextResponse(res.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Network error";
    return NextResponse.json(
      { error: `TTS error: ${msg}`, fallback: true },
      { status: 503 }
    );
  }
}
