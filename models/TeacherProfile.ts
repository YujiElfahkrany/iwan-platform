import mongoose, { Schema, model, models } from "mongoose";

export interface ITeacherProfile {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  subjects: string[];
  experienceYears: number;
  qualifications: string[];
  certifications: string[];
  bio: string;
  languages: string[];
  hourlyRate: number;
  timezone: string;
  rating: number;
  totalReviews: number;
  credentialImage?: string;
}

const TeacherProfileSchema = new Schema<ITeacherProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    subjects: [{ type: String }],
    experienceYears: { type: Number, default: 0 },
    qualifications: [{ type: String }],
    certifications: [{ type: String }],
    bio: { type: String, default: "" },
    languages: [{ type: String }],
    hourlyRate: { type: Number, default: 0 },
    timezone: { type: String, default: "UTC" },
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    credentialImage: { type: String },
  },
  { timestamps: true }
);

export const TeacherProfile =
  models.TeacherProfile ?? model<ITeacherProfile>("TeacherProfile", TeacherProfileSchema);
