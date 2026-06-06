import mongoose, { Schema, model, models } from "mongoose";

export interface ISlot {
  _id: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  price: number;
  status: "available" | "booked" | "cancelled";
  bookingId?: mongoose.Types.ObjectId;
}

const SlotSchema = new Schema<ISlot>(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    durationMinutes: { type: Number, required: true },
    price: { type: Number, required: true },
    status: { type: String, enum: ["available", "booked", "cancelled"], default: "available" },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
  },
  { timestamps: true }
);

SlotSchema.index({ teacherId: 1, startTime: 1 });
SlotSchema.index({ status: 1, startTime: 1 });

export const Slot = models.Slot ?? model<ISlot>("Slot", SlotSchema);
