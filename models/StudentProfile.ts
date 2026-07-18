import mongoose, { Schema, model, models } from "mongoose";
import { AGE_MIN, AGE_MAX } from "@/lib/constants";

export type LearningLevel = "beginner" | "intermediate" | "advanced";

export interface IStudentProfile {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  subjects: string[];
  age?: number;
  learningLevel: LearningLevel;
  learningHistory: string;
  goals: string;
  languages: string[];
  timezone: string;
}

const StudentProfileSchema = new Schema<IStudentProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    subjects: [{ type: String }],
    age: { type: Number, min: AGE_MIN, max: AGE_MAX },
    learningLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    learningHistory: { type: String, default: "" },
    goals: { type: String, default: "" },
    languages: [{ type: String }],
    timezone: { type: String, default: "UTC" },
  },
  { timestamps: true }
);

export const StudentProfile =
  models.StudentProfile ?? model<IStudentProfile>("StudentProfile", StudentProfileSchema);
