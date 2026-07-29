import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Recording } from "@/models/Recording";
import { PART_URL_BATCH, buildObjectKey, recordingExpiry } from "@/lib/recording";
import { hasActiveRecording } from "@/lib/recordingStore";
import { createMultipartUpload, isR2Configured, presignPartBatch } from "@/lib/r2";

// Starts a recording: opens the R2 multipart upload, records it, and hands the
// teacher's browser its first batch of presigned part URLs.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!isR2Configured()) {
      return NextResponse.json({ error: "Recording is not configured" }, { status: 500 });
    }

    const { bookingId } = await req.json();
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return NextResponse.json({ error: "Invalid booking" }, { status: 400 });
    }

    await connectDB();
    const booking = await Booking.findById(bookingId).lean();
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    // Only the teacher of a confirmed booking may record it.
    if (booking.teacherId.toString() !== session.user.id || booking.status !== "confirmed") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // The id is minted up front because the object key embeds it.
    const _id = new mongoose.Types.ObjectId();
    const startedAt = new Date();

    // One recording per room at a time. Otherwise a repeated POST opens an
    // unbounded number of multipart uploads, each billable and each holding its
    // own set of presigned part URLs.
    if (await hasActiveRecording(booking.meetingRoomName, startedAt)) {
      return NextResponse.json({ error: "A recording is already in progress" }, { status: 409 });
    }

    const objectKey = buildObjectKey(booking.meetingRoomName, startedAt, _id.toString());
    const uploadId = await createMultipartUpload(objectKey);

    await Recording.create({
      _id,
      channel: booking.meetingRoomName,
      teacherId: booking.teacherId,
      status: "recording",
      objectKey,
      uploadId,
      startedAt,
      lastPartAt: startedAt,
      expiresAt: recordingExpiry(startedAt),
    });

    const partUrls = await presignPartBatch(objectKey, uploadId, 1, PART_URL_BATCH);

    return NextResponse.json({ recordingId: _id.toString(), partUrls });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
