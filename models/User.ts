import mongoose, { Schema, model, models } from "mongoose";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: "student" | "teacher" | "admin";
  balance: number;
  avatar?: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student", "teacher", "admin"], required: true },
    balance: { type: Number, default: 0 },
    avatar: { type: String },
  },
  { timestamps: true }
);

export const User = models.User ?? model<IUser>("User", UserSchema);
