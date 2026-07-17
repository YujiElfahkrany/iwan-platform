import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Class, IClass } from "@/models/Class";
import { removeStudentFromClasses } from "@/lib/enrollment";

let mongod: MongoMemoryServer;

const studentId = new mongoose.Types.ObjectId();
const otherStudentId = new mongoose.Types.ObjectId();

function makeClass(overrides: Partial<IClass> = {}) {
  return Class.create({
    teacherId: new mongoose.Types.ObjectId(),
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

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Class.deleteMany({});
});

describe("removeStudentFromClasses", () => {
  it("removes the student from all enrolled classes while keeping other students", async () => {
    const classA = await makeClass({ enrolledStudents: [studentId, otherStudentId] });
    const classB = await makeClass({ enrolledStudents: [studentId] });

    await removeStudentFromClasses(studentId);

    const updatedA = await Class.findById(classA._id).lean();
    const updatedB = await Class.findById(classB._id).lean();
    expect(updatedA?.enrolledStudents.map(String)).toEqual([otherStudentId.toString()]);
    expect(updatedB?.enrolledStudents).toHaveLength(0);
  });

  it("sets a full class back to open when the roster drops below maxStudents", async () => {
    const fullClass = await makeClass({
      maxStudents: 2,
      enrolledStudents: [studentId, otherStudentId],
      status: "full",
    });

    await removeStudentFromClasses(studentId);

    const updated = await Class.findById(fullClass._id).lean();
    expect(updated?.status).toBe("open");
    expect(updated?.enrolledStudents.map(String)).toEqual([otherStudentId.toString()]);
  });

  it("keeps a completed class completed even after removal", async () => {
    const completedClass = await makeClass({
      maxStudents: 1,
      enrolledStudents: [studentId],
      status: "completed",
    });

    await removeStudentFromClasses(studentId);

    const updated = await Class.findById(completedClass._id).lean();
    expect(updated?.status).toBe("completed");
    expect(updated?.enrolledStudents).toHaveLength(0);
  });

  it("keeps a cancelled class cancelled even after removal", async () => {
    const cancelledClass = await makeClass({
      maxStudents: 1,
      enrolledStudents: [studentId],
      status: "cancelled",
    });

    await removeStudentFromClasses(studentId);

    const updated = await Class.findById(cancelledClass._id).lean();
    expect(updated?.status).toBe("cancelled");
  });

  it("does not touch classes the student is not enrolled in", async () => {
    const untouched = await makeClass({
      maxStudents: 1,
      enrolledStudents: [otherStudentId],
      status: "full",
    });

    await removeStudentFromClasses(studentId);

    const updated = await Class.findById(untouched._id).lean();
    expect(updated?.status).toBe("full");
    expect(updated?.enrolledStudents.map(String)).toEqual([otherStudentId.toString()]);
  });

  it("returns the number of classes the student was removed from", async () => {
    await makeClass({ enrolledStudents: [studentId] });
    await makeClass({ enrolledStudents: [studentId, otherStudentId] });
    await makeClass({ enrolledStudents: [otherStudentId] });

    const count = await removeStudentFromClasses(studentId);
    expect(count).toBe(2);
  });

  it("accepts a string id", async () => {
    await makeClass({ enrolledStudents: [studentId] });

    const count = await removeStudentFromClasses(studentId.toString());
    expect(count).toBe(1);

    const remaining = await Class.countDocuments({ enrolledStudents: studentId });
    expect(remaining).toBe(0);
  });

  it("returns 0 when the student is enrolled in no classes", async () => {
    await makeClass({ enrolledStudents: [otherStudentId] });
    const count = await removeStudentFromClasses(studentId);
    expect(count).toBe(0);
  });
});
