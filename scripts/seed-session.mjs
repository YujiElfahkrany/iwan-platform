// Dev helper: creates a teacher, a student, and two confirmed bookings whose
// sessions are joinable right now — a 1-on-1 and a group class. Getting to a
// joinable session through the UI otherwise means registering, requesting a
// top-up and having an admin approve it, which is a lot of clicking when all
// you want is to open the video room.
//
//   ./scripts/seed-session.sh
//
// Re-running it is safe: existing docs are reused and the session times are
// moved back into the join window.
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI not set");
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB");

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, lowercase: true },
    passwordHash: String,
    role: String,
    balance: { type: Number, default: 0 },
    gender: String,
    age: Number,
    approved: Boolean,
  },
  { timestamps: true, strict: false }
);

const SlotSchema = new mongoose.Schema(
  {
    teacherId: mongoose.Schema.Types.ObjectId,
    startTime: Date,
    endTime: Date,
    durationMinutes: Number,
    price: Number,
    isBooked: Boolean,
    status: String,
  },
  { timestamps: true, strict: false }
);

const ClassSchema = new mongoose.Schema(
  {
    teacherId: mongoose.Schema.Types.ObjectId,
    title: String,
    description: String,
    subject: String,
    startTime: Date,
    endTime: Date,
    price: Number,
    maxStudents: Number,
    enrolledStudents: [mongoose.Schema.Types.ObjectId],
    meetingRoomName: String,
    status: String,
    totalSessions: Number,
    curriculum: Array,
    daysOfWeek: [String],
  },
  { timestamps: true, strict: false }
);

const BookingSchema = new mongoose.Schema(
  {
    studentId: mongoose.Schema.Types.ObjectId,
    teacherId: mongoose.Schema.Types.ObjectId,
    type: String,
    slotId: mongoose.Schema.Types.ObjectId,
    classId: mongoose.Schema.Types.ObjectId,
    status: String,
    pricePaid: Number,
    meetingRoomName: String,
  },
  { timestamps: true, strict: false }
);

const User = mongoose.models.User ?? mongoose.model("User", UserSchema);
const Slot = mongoose.models.Slot ?? mongoose.model("Slot", SlotSchema);
const Class = mongoose.models.Class ?? mongoose.model("Class", ClassSchema);
const Booking = mongoose.models.Booking ?? mongoose.model("Booking", BookingSchema);

const PASSWORD = "test1234";
const passwordHash = await bcrypt.hash(PASSWORD, 12);

// Start the session five minutes ago so it is inside the ten-minute join window
// and still running for the next hour.
const now = new Date();
const startTime = new Date(now.getTime() - 5 * 60 * 1000);
const endTime = new Date(now.getTime() + 60 * 60 * 1000);

async function upsertUser(email, fields) {
  const existing = await User.findOne({ email });
  if (existing) {
    Object.assign(existing, fields, { passwordHash });
    await existing.save();
    console.log(`  Reused ${fields.role}: ${email}`);
    return existing;
  }
  const created = await User.create({ email, passwordHash, ...fields });
  console.log(`  Created ${fields.role}: ${email}`);
  return created;
}

console.log("\nAccounts");
const teacher = await upsertUser("teacher@iwan.test", {
  name: "Session Teacher",
  role: "teacher",
  gender: "male",
  approved: true,
  balance: 0,
});
const student = await upsertUser("student@iwan.test", {
  name: "Session Student",
  role: "student",
  gender: "female",
  age: 16,
  balance: 1000,
});

function roomName(prefix) {
  return `iwan-${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

console.log("\n1-on-1 session");
let slot = await Slot.findOne({ teacherId: teacher._id, price: 100 });
if (slot) {
  Object.assign(slot, { startTime, endTime, isBooked: true, status: "booked" });
  await slot.save();
} else {
  slot = await Slot.create({
    teacherId: teacher._id,
    startTime,
    endTime,
    durationMinutes: 60,
    price: 100,
    isBooked: true,
    status: "booked",
  });
}

let oneOnOne = await Booking.findOne({ studentId: student._id, teacherId: teacher._id, type: "1on1" });
if (oneOnOne) {
  Object.assign(oneOnOne, { slotId: slot._id, status: "confirmed" });
  await oneOnOne.save();
} else {
  oneOnOne = await Booking.create({
    studentId: student._id,
    teacherId: teacher._id,
    type: "1on1",
    slotId: slot._id,
    status: "confirmed",
    pricePaid: 100,
    meetingRoomName: roomName("1on1"),
  });
}
console.log(`  Booking ${oneOnOne._id} — room ${oneOnOne.meetingRoomName}`);

console.log("\nGroup class (this one also produces AI session notes)");
let cls = await Class.findOne({ teacherId: teacher._id, title: "Local Test Class" });
if (cls) {
  Object.assign(cls, { startTime, endTime, enrolledStudents: [student._id] });
  await cls.save();
} else {
  cls = await Class.create({
    teacherId: teacher._id,
    title: "Local Test Class",
    description: "Seeded for local testing.",
    subject: "رياضيات",
    startTime,
    endTime,
    price: 60,
    maxStudents: 5,
    enrolledStudents: [student._id],
    meetingRoomName: roomName("class"),
    status: "open",
    totalSessions: 1,
    curriculum: [],
    daysOfWeek: [],
  });
}

let classBooking = await Booking.findOne({ studentId: student._id, classId: cls._id });
if (classBooking) {
  Object.assign(classBooking, { status: "confirmed", meetingRoomName: cls.meetingRoomName });
  await classBooking.save();
} else {
  classBooking = await Booking.create({
    studentId: student._id,
    teacherId: teacher._id,
    type: "class",
    classId: cls._id,
    status: "confirmed",
    pricePaid: 60,
    meetingRoomName: cls.meetingRoomName,
  });
}
console.log(`  Booking ${classBooking._id} — room ${classBooking.meetingRoomName}`);

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
console.log(`
Ready. Log in with password "${PASSWORD}":
  teacher@iwan.test   (records, and its record button only shows for them)
  student@iwan.test

Open the same session in two browser profiles:
  1-on-1  ${base}/en/session/${oneOnOne._id}
  class   ${base}/ar/session/${classBooking._id}

Swap the /en/ or /ar/ prefix for /ru/ to check the Russian layout.
`);

await mongoose.disconnect();
