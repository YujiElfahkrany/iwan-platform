import mongoose, { Schema, model, models } from "mongoose";

export interface IClass {
  _id: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  subject: string;
  startTime: Date;
  endTime: Date;
  price: number;
  maxStudents: number;
  enrolledStudents: mongoose.Types.ObjectId[];
  meetingRoomName: string;
  status: "open" | "full" | "completed" | "cancelled";
}

const ClassSchema = new Schema<IClass>(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    subject: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    price: { type: Number, required: true },
    maxStudents: { type: Number, required: true },
    enrolledStudents: [{ type: Schema.Types.ObjectId, ref: "User" }],
    meetingRoomName: { type: String, required: true },
    status: { type: String, enum: ["open", "full", "completed", "cancelled"], default: "open" },
  },
  { timestamps: true }
);

ClassSchema.index({ teacherId: 1, startTime: 1 });
ClassSchema.index({ subject: 1, startTime: 1 });

export const Class = models.Class ?? model<IClass>("Class", ClassSchema);
