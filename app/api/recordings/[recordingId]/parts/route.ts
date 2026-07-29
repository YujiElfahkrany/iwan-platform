import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Recording, IRecording } from "@/models/Recording";
import { validatePartRequest } from "@/lib/recording";
import { touchHeartbeat } from "@/lib/recordingStore";
import { presignPartBatch } from "@/lib/r2";

// Hands out the next batch of presigned part URLs. Each call doubles as the
// recorder's heartbeat, which is how the cron sweep spots dead teacher tabs.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { recordingId } = await params;
    if (!mongoose.Types.ObjectId.isValid(recordingId)) {
      return NextResponse.json({ error: "Invalid recording" }, { status: 400 });
    }

    const body: unknown = await req.json();
    const { fromPart, count } = (body ?? {}) as { fromPart?: unknown; count?: unknown };
    const request = validatePartRequest(fromPart, count);
    if (!request.ok) return NextResponse.json({ error: request.error }, { status: 400 });

    await connectDB();
    // Ownership, status, and heartbeat in one atomic update.
    const recording = await touchHeartbeat(recordingId, session.user.id, new Date());
    if (!recording) {
      // Tell the client which of the three reasons it was: only "not active"
      // means stop uploading.
      const existing = await Recording.findById(recordingId).lean<IRecording>();
      if (!existing) return NextResponse.json({ error: "Recording not found" }, { status: 404 });
      if (existing.teacherId.toString() !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ error: "Recording is not active" }, { status: 409 });
    }

    const urls = await presignPartBatch(
      recording.objectKey,
      recording.uploadId,
      request.fromPart,
      request.count
    );

    return NextResponse.json({ urls });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
