import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { User } from "@/models/User";
import { Class, IClass } from "@/models/Class";
import { Booking, IBooking } from "@/models/Booking";
import { TeacherProfile } from "@/models/TeacherProfile";
import { StudentProfile } from "@/models/StudentProfile";
import { AssignmentSubmission } from "@/models/AssignmentSubmission";
import { deleteClassCascade, deleteUserCascade } from "@/lib/adminCascade";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all(
    [User, Class, Booking, TeacherProfile, StudentProfile, AssignmentSubmission].map((m) =>
      m.deleteMany({})
    )
  );
});

function makeUser(role: "student" | "teacher") {
  return User.create({
    name: `Test ${role}`,
    email: `${role}-${new mongoose.Types.ObjectId().toString()}@test.com`,
    passwordHash: "hash",
    role,
  });
}

function makeClass(teacherId: mongoose.Types.ObjectId, overrides: Partial<IClass> = {}) {
  return Class.create({
    teacherId,
    title: "Test class",
    description: "",
    subject: "math",
    startTime: new Date("2026-08-01T10:00:00Z"),
    endTime: new Date("2026-08-01T11:00:00Z"),
    price: 10,
    maxStudents: 3,
    enrolledStudents: [],
    meetingRoomName: "iwan-test-room",
    status: "open",
    ...overrides,
  });
}

function makeBooking(
  studentId: mongoose.Types.ObjectId,
  teacherId: mongoose.Types.ObjectId,
  overrides: Partial<IBooking> = {}
) {
  return Booking.create({
    studentId,
    teacherId,
    type: overrides.classId ? "class" : "1on1",
    meetingRoomName: "iwan-test-booking",
    status: "confirmed",
    ...overrides,
  });
}

function makeSubmission(classId: mongoose.Types.ObjectId, studentId: mongoose.Types.ObjectId) {
  return AssignmentSubmission.create({
    classId,
    studentId,
    sessionNumber: 1,
    assignmentTitle: "Homework",
    maxMarks: 10,
    fileData: "data",
    fileName: "hw.pdf",
  });
}

describe("deleteClassCascade", () => {
  it("deletes the class, its submissions, and bookings referencing it", async () => {
    const teacher = await makeUser("teacher");
    const student = await makeUser("student");
    const cls = await makeClass(teacher._id, { enrolledStudents: [student._id] });
    await makeSubmission(cls._id, student._id);
    await makeBooking(student._id, teacher._id, { classId: cls._id });

    await deleteClassCascade(cls._id);

    expect(await Class.findById(cls._id)).toBeNull();
    expect(await AssignmentSubmission.countDocuments({ classId: cls._id })).toBe(0);
    expect(await Booking.countDocuments({ classId: cls._id })).toBe(0);
  });

  it("leaves unrelated classes, submissions, and bookings untouched", async () => {
    const teacher = await makeUser("teacher");
    const student = await makeUser("student");
    const target = await makeClass(teacher._id);
    const other = await makeClass(teacher._id);
    await makeSubmission(other._id, student._id);
    await makeBooking(student._id, teacher._id, { classId: other._id });
    const oneOnOne = await makeBooking(student._id, teacher._id);

    await deleteClassCascade(target._id);

    expect(await Class.findById(other._id)).not.toBeNull();
    expect(await AssignmentSubmission.countDocuments({ classId: other._id })).toBe(1);
    expect(await Booking.countDocuments({ classId: other._id })).toBe(1);
    expect(await Booking.findById(oneOnOne._id)).not.toBeNull();
  });
});

describe("deleteUserCascade (teacher)", () => {
  it("deletes the teacher, profile, classes, class submissions, and bookings keyed by teacherId", async () => {
    const teacher = await makeUser("teacher");
    const student = await makeUser("student");
    await TeacherProfile.create({ userId: teacher._id });
    const cls = await makeClass(teacher._id, { enrolledStudents: [student._id] });
    await makeSubmission(cls._id, student._id);
    await makeBooking(student._id, teacher._id); // 1on1 keyed by teacherId

    await deleteUserCascade({ _id: teacher._id, role: "teacher" });

    expect(await User.findById(teacher._id)).toBeNull();
    expect(await TeacherProfile.countDocuments({ userId: teacher._id })).toBe(0);
    expect(await Class.countDocuments({ teacherId: teacher._id })).toBe(0);
    expect(await AssignmentSubmission.countDocuments({ classId: cls._id })).toBe(0);
    expect(await Booking.countDocuments({ teacherId: teacher._id })).toBe(0);
  });

  it("also deletes enrolled students' bookings that reference the teacher's classes", async () => {
    const teacher = await makeUser("teacher");
    const student = await makeUser("student");
    const cls = await makeClass(teacher._id, { enrolledStudents: [student._id] });
    await makeBooking(student._id, teacher._id, { classId: cls._id });

    await deleteUserCascade({ _id: teacher._id, role: "teacher" });

    expect(await Booking.countDocuments({ classId: cls._id })).toBe(0);
  });

  it("leaves unrelated teachers, classes, and bookings untouched", async () => {
    const teacher = await makeUser("teacher");
    const otherTeacher = await makeUser("teacher");
    const student = await makeUser("student");
    await TeacherProfile.create({ userId: otherTeacher._id });
    const otherClass = await makeClass(otherTeacher._id);
    await makeSubmission(otherClass._id, student._id);
    await makeBooking(student._id, otherTeacher._id, { classId: otherClass._id });
    await makeBooking(student._id, otherTeacher._id);

    await deleteUserCascade({ _id: teacher._id, role: "teacher" });

    expect(await User.findById(otherTeacher._id)).not.toBeNull();
    expect(await TeacherProfile.countDocuments({ userId: otherTeacher._id })).toBe(1);
    expect(await Class.findById(otherClass._id)).not.toBeNull();
    expect(await AssignmentSubmission.countDocuments({ classId: otherClass._id })).toBe(1);
    expect(await Booking.countDocuments({ teacherId: otherTeacher._id })).toBe(2);
  });
});

describe("deleteUserCascade (student)", () => {
  it("deletes the student, profile, bookings keyed by studentId, and submissions", async () => {
    const teacher = await makeUser("teacher");
    const student = await makeUser("student");
    await StudentProfile.create({ userId: student._id });
    const cls = await makeClass(teacher._id, { enrolledStudents: [student._id] });
    await makeSubmission(cls._id, student._id);
    await makeBooking(student._id, teacher._id);
    await makeBooking(student._id, teacher._id, { classId: cls._id });

    await deleteUserCascade({ _id: student._id, role: "student" });

    expect(await User.findById(student._id)).toBeNull();
    expect(await StudentProfile.countDocuments({ userId: student._id })).toBe(0);
    expect(await Booking.countDocuments({ studentId: student._id })).toBe(0);
    expect(await AssignmentSubmission.countDocuments({ studentId: student._id })).toBe(0);
  });

  it("pulls the student from class rosters but keeps the classes", async () => {
    const teacher = await makeUser("teacher");
    const student = await makeUser("student");
    const otherStudent = await makeUser("student");
    const cls = await makeClass(teacher._id, {
      enrolledStudents: [student._id, otherStudent._id],
    });

    await deleteUserCascade({ _id: student._id, role: "student" });

    const updated = await Class.findById(cls._id).lean();
    expect(updated).not.toBeNull();
    expect(updated?.enrolledStudents.map(String)).toEqual([otherStudent._id.toString()]);
  });

  it("leaves other students' data untouched", async () => {
    const teacher = await makeUser("teacher");
    const student = await makeUser("student");
    const otherStudent = await makeUser("student");
    await StudentProfile.create({ userId: otherStudent._id });
    const cls = await makeClass(teacher._id, { enrolledStudents: [otherStudent._id] });
    await makeSubmission(cls._id, otherStudent._id);
    await makeBooking(otherStudent._id, teacher._id);

    await deleteUserCascade({ _id: student._id, role: "student" });

    expect(await User.findById(otherStudent._id)).not.toBeNull();
    expect(await StudentProfile.countDocuments({ userId: otherStudent._id })).toBe(1);
    expect(await Booking.countDocuments({ studentId: otherStudent._id })).toBe(1);
    expect(await AssignmentSubmission.countDocuments({ studentId: otherStudent._id })).toBe(1);
  });
});
