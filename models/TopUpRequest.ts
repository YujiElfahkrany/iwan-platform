import mongoose, { Schema, model, models } from "mongoose";

export interface ITopUpRequest {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  amount: number;
  receiptData: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
}

const TopUpRequestSchema = new Schema<ITopUpRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 1 },
    receiptData: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

export const TopUpRequest = models.TopUpRequest ?? model<ITopUpRequest>("TopUpRequest", TopUpRequestSchema);
