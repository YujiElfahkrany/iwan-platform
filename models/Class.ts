import mongoose, { Schema, model, models } from "mongoose";

export interface ICurriculumItem {
  sessionNumber: number;
  assignmentTitle: string;
  description: string;
  maxMarks: number;
}

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
  totalSessions: number;
  curriculum: ICurriculumItem[];
}

const CurriculumItemSchema = new Schema<ICurriculumItem>(
  {
    sessionNumber: { type: Number, required: true },
    assignmentTitle: { type: String, required: true },
    description: { type: String, default: "" },
    maxMarks: { type: Number, required: true },
  },
  { _id: false }
);

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
    totalSessions: { type: Number, default: 1 },
    curriculum: { type: [CurriculumItemSchema], default: [] },
  },
  { timestamps: true }
);

ClassSchema.index({ teacherId: 1, startTime: 1 });
ClassSchema.index({ subject: 1, startTime: 1 });

if (process.env.NODE_ENV !== "production" && models.Class) {
  delete (models as Record<string, unknown>).Class;
}
export const Class = models.Class ?? model<IClass>("Class", ClassSchema);
