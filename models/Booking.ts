import mongoose, { Schema, model, models } from "mongoose";

export interface IBooking {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  type: "1on1" | "class";
  slotId?: mongoose.Types.ObjectId;
  classId?: mongoose.Types.ObjectId;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  stripePaymentIntentId?: string;
  stripeSessionId?: string;
  stripePaymentStatus?: string;
  meetingRoomName: string;
  createdAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["1on1", "class"], required: true },
    slotId: { type: Schema.Types.ObjectId, ref: "Slot" },
    classId: { type: Schema.Types.ObjectId, ref: "Class" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
    },
    stripePaymentIntentId: { type: String },
    stripeSessionId: { type: String },
    stripePaymentStatus: { type: String },
    meetingRoomName: { type: String, required: true },
  },
  { timestamps: true }
);

BookingSchema.index({ studentId: 1, status: 1 });
BookingSchema.index({ teacherId: 1, status: 1 });

export const Booking = models.Booking ?? model<IBooking>("Booking", BookingSchema);
