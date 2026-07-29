import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { SessionTranscript } from "@/models/SessionTranscript";
import {
  MAX_TRANSCRIPT_LINES,
  transcriptDateKey,
  validateTranscriptLines,
} from "@/lib/sessionNotes";

// Speaker clients append their final caption lines here; the accumulated
// transcript is what the session-notes cron later summarizes.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { bookingId, lines } = await req.json();
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return NextResponse.json({ error: "Invalid booking" }, { status: 400 });
    }

    await connectDB();
    const booking = await Booking.findById(bookingId).lean();
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const isParticipant =
      booking.studentId.toString() === session.user.id ||
      booking.teacherId.toString() === session.user.id;
    // Same bar as joining the call: only a confirmed booking may contribute.
    if (!isParticipant || booking.status !== "confirmed") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (booking.type !== "class") {
      return NextResponse.json(
        { error: "Transcripts are only stored for class sessions" },
        { status: 400 }
      );
    }

    // Every decision that depends on time uses this one server reading, so a
    // client cannot pick which day its lines land on or how soon the transcript
    // looks finished. Line timestamps are only kept for ordering within the day.
    const now = new Date();
    const validated = validateTranscriptLines(lines, now);
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

    // The speaker name is taken from the session, never from the request: a
    // participant must not be able to attribute their words to someone else.
    const speakerName = session.user.name ?? session.user.email ?? "Participant";
    const attributedLines = validated.lines.map((line) => ({ ...line, name: speakerName }));

    await SessionTranscript.updateOne(
      { channel: booking.meetingRoomName, dateKey: transcriptDateKey(now) },
      {
        $push: { lines: { $each: attributedLines, $slice: -MAX_TRANSCRIPT_LINES } },
        // $max keeps the quiet-period clock monotonic when batches from
        // different speakers arrive out of order.
        $max: { lastLineAt: now },
        $setOnInsert: { classId: booking.classId, noteStatus: "pending", noteAttempts: 0 },
      },
      { upsert: true }
    );

    return NextResponse.json({ saved: validated.lines.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
