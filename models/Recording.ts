import mongoose, { Schema, model, models } from "mongoose";
import type { RecordingStatus } from "@/lib/recording";

export interface IRecording {
  _id: mongoose.Types.ObjectId;
  /**
   * The Agora channel (= Booking.meetingRoomName). Recordings are keyed by
   * channel, not booking: a group class has N bookings sharing one room.
   */
  channel: string;
  teacherId: mongoose.Types.ObjectId;
  status: RecordingStatus;
  /** R2 object key (server-built, never client-supplied). */
  objectKey: string;
  /** R2 multipart upload id. */
  uploadId: string;
  startedAt: Date;
  endedAt?: Date;
  /** Heartbeat: bumped whenever the client requests part URLs. */
  lastPartAt: Date;
  /** startedAt + retention window; docs are swept, objects expire via R2 lifecycle. */
  expiresAt: Date;
}

const RecordingSchema = new Schema<IRecording>(
  {
    channel: { type: String, required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["recording", "completed", "finalized", "failed"],
      default: "recording",
    },
    objectKey: { type: String, required: true },
    uploadId: { type: String, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    lastPartAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

RecordingSchema.index({ channel: 1, startedAt: -1 });
RecordingSchema.index({ status: 1, lastPartAt: 1 });
RecordingSchema.index({ expiresAt: 1 });

if (process.env.NODE_ENV !== "production" && models.Recording) {
  delete (models as Record<string, unknown>).Recording;
}
export const Recording = models.Recording ?? model<IRecording>("Recording", RecordingSchema);
