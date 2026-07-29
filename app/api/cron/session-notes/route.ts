import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { generateSessionNotes, isGeminiConfigured } from "@/lib/gemini";
import { sweepSessionNotes } from "@/lib/sessionNotesSweep";

// Runs periodically: summarizes each group-class transcript that has been quiet
// long enough for the session to be over, in all platform languages.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: "Gemini is not configured" }, { status: 500 });
  }

  try {
    await connectDB();
    const result = await sweepSessionNotes({ generate: generateSessionNotes }, new Date());
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
