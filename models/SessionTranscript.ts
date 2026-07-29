import mongoose, { Schema, model, models } from "mongoose";
import type { NoteStatus, SessionNote, TranscriptLine } from "@/lib/sessionNotes";

export interface ISessionTranscript {
  _id: mongoose.Types.ObjectId;
  /**
   * The Agora channel (= Booking.meetingRoomName). Transcripts are keyed by
   * channel, not booking: a group class has N bookings sharing one room.
   */
  channel: string;
  classId?: mongoose.Types.ObjectId;
  /** Calendar day of the session in the platform timezone (YYYY-MM-DD), so a
   * recurring class gets one transcript per session instead of one forever. */
  dateKey: string;
  lines: TranscriptLine[];
  /** Newest line's timestamp: the sweep uses it to tell the session ended. */
  lastLineAt: Date;
  noteStatus: NoteStatus;
  note?: SessionNote;
  noteGeneratedAt?: Date;
  noteAttempts: number;
}

const TranscriptLineSchema = new Schema<TranscriptLine>(
  {
    at: { type: Date, required: true },
    name: { type: String, required: true },
    lang: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const SessionNoteSchema = new Schema<SessionNote>(
  {
    en: { type: String, required: true },
    ar: { type: String, required: true },
    ru: { type: String, required: true },
  },
  { _id: false }
);

const SessionTranscriptSchema = new Schema<ISessionTranscript>(
  {
    channel: { type: String, required: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class" },
    dateKey: { type: String, required: true },
    lines: { type: [TranscriptLineSchema], default: [] },
    lastLineAt: { type: Date, required: true },
    noteStatus: { type: String, enum: ["pending", "done", "failed"], default: "pending" },
    note: { type: SessionNoteSchema },
    noteGeneratedAt: { type: Date },
    noteAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Unique so the concurrent appends of every speaker in a room converge on one
// document per session instead of racing to insert duplicates.
SessionTranscriptSchema.index({ channel: 1, dateKey: 1 }, { unique: true });
SessionTranscriptSchema.index({ noteStatus: 1, lastLineAt: 1 });

if (process.env.NODE_ENV !== "production" && models.SessionTranscript) {
  delete (models as Record<string, unknown>).SessionTranscript;
}
export const SessionTranscript =
  models.SessionTranscript ??
  model<ISessionTranscript>("SessionTranscript", SessionTranscriptSchema);
