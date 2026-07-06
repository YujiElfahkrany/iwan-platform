import mongoose, { Schema, model, models } from "mongoose";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: "student" | "teacher" | "admin";
  status: "pending" | "approved" | "rejected";
  balance: number;
  avatar?: string;
  phone?: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student", "teacher", "admin"], required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
    balance: { type: Number, default: 0 },
    avatar: { type: String },
    phone: { type: String },
  },
  { timestamps: true }
);

export const User = models.User ?? model<IUser>("User", UserSchema);
