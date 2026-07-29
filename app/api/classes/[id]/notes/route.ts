import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Class } from "@/models/Class";
import { SessionTranscript } from "@/models/SessionTranscript";
import { routing } from "@/i18n/routing";
import { MAX_NOTED_SESSIONS, type NoteStatus, type SessionNote } from "@/lib/sessionNotes";

type ViewerLocale = (typeof routing.locales)[number];

/** The projection this route reads: never the transcript lines themselves. */
interface NotedSession {
  dateKey: string;
  noteStatus: NoteStatus;
  note?: SessionNote;
}

/** Falls back to the platform default for a missing or unknown ?locale=. */
function readViewerLocale(raw: string | null): ViewerLocale {
  return raw !== null && (routing.locales as readonly string[]).includes(raw)
    ? (raw as ViewerLocale)
    : routing.defaultLocale;
}

/**
 * Session notes of one group class, already reduced to the viewer's language.
 * The stored document holds all three translations plus (until the notes are
 * generated) the raw speech of every participant — none of that leaves here.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid class" }, { status: 400 });
    }

    await connectDB();
    const cls = await Class.findById(id).lean();
    if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    const isTeacher = cls.teacherId.toString() === session.user.id;
    const isEnrolled = cls.enrolledStudents.some(
      (studentId: mongoose.Types.ObjectId) => studentId.toString() === session.user.id
    );
    if (!isTeacher && !isEnrolled) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const locale = readViewerLocale(req.nextUrl.searchParams.get("locale"));

    // Notes are keyed by Agora channel, which for a class is its meeting room.
    // dateKey is YYYY-MM-DD, so a lexical descending sort is newest first. The
    // limit bounds the response: a channel with many session days must not turn
    // one request into megabytes of notes.
    const sessions = (await SessionTranscript.find({ channel: cls.meetingRoomName })
      .select("dateKey noteStatus note")
      .sort({ dateKey: -1 })
      .limit(MAX_NOTED_SESSIONS)
      .lean()) as NotedSession[];

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        dateKey: s.dateKey,
        status: s.noteStatus,
        note: s.note?.[locale] ?? null,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
