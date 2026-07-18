import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Class, IClass } from "@/models/Class";
import {
  enrollStudentInClass,
  removeStudentFromClasses,
  unenrollStudentFromClass,
} from "@/lib/enrollment";

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

describe("enrollStudentInClass", () => {
  it("enrolls a student in an open class and returns the updated class", async () => {
    const cls = await makeClass({ maxStudents: 3 });

    const result = await enrollStudentInClass(cls._id.toString(), studentId.toString());

    expect(result.enrolled).toBe(true);
    expect(result.class?.enrolledStudents.map(String)).toEqual([studentId.toString()]);

    const updated = await Class.findById(cls._id).lean();
    expect(updated?.enrolledStudents.map(String)).toEqual([studentId.toString()]);
    expect(updated?.status).toBe("open");
  });

  it("sets status to full when enrollment reaches capacity", async () => {
    const cls = await makeClass({ maxStudents: 2, enrolledStudents: [otherStudentId] });

    const result = await enrollStudentInClass(cls._id, studentId);

    expect(result.enrolled).toBe(true);
    const updated = await Class.findById(cls._id).lean();
    expect(updated?.enrolledStudents).toHaveLength(2);
    expect(updated?.status).toBe("full");
  });

  it("rejects enrollment when the class is at capacity", async () => {
    const cls = await makeClass({
      maxStudents: 1,
      enrolledStudents: [otherStudentId],
      status: "full",
    });

    const result = await enrollStudentInClass(cls._id, studentId);

    expect(result.enrolled).toBe(false);
    expect(result.class).toBeUndefined();
    const updated = await Class.findById(cls._id).lean();
    expect(updated?.enrolledStudents.map(String)).toEqual([otherStudentId.toString()]);
    expect(updated?.status).toBe("full");
  });

  it("rejects enrollment in completed and cancelled classes", async () => {
    const completed = await makeClass({ status: "completed" });
    const cancelled = await makeClass({ status: "cancelled" });

    expect((await enrollStudentInClass(completed._id, studentId)).enrolled).toBe(false);
    expect((await enrollStudentInClass(cancelled._id, studentId)).enrolled).toBe(false);

    expect((await Class.findById(completed._id).lean())?.enrolledStudents).toHaveLength(0);
    expect((await Class.findById(cancelled._id).lean())?.enrolledStudents).toHaveLength(0);
  });

  it("rejects enrollment when the class does not exist", async () => {
    const result = await enrollStudentInClass(new mongoose.Types.ObjectId(), studentId);
    expect(result.enrolled).toBe(false);
  });

  it("treats double-enrollment as enrolled without duplicating the student", async () => {
    const cls = await makeClass({ maxStudents: 3 });

    const first = await enrollStudentInClass(cls._id, studentId);
    const second = await enrollStudentInClass(cls._id, studentId);

    expect(first.enrolled).toBe(true);
    expect(second.enrolled).toBe(true);
    const updated = await Class.findById(cls._id).lean();
    expect(updated?.enrolledStudents.map(String)).toEqual([studentId.toString()]);
    expect(updated?.status).toBe("open");
  });

  it("never exceeds maxStudents when many students race for seats", async () => {
    const cls = await makeClass({ maxStudents: 3 });
    const applicants = Array.from({ length: 6 }, () => new mongoose.Types.ObjectId());

    const results = await Promise.all(
      applicants.map((id) => enrollStudentInClass(cls._id, id))
    );

    const successes = results.filter((r) => r.enrolled).length;
    expect(successes).toBe(3);
    const updated = await Class.findById(cls._id).lean();
    expect(updated?.enrolledStudents).toHaveLength(3);
    expect(updated?.status).toBe("full");
  });
});

describe("unenrollStudentFromClass", () => {
  it("removes the student and flips a full class back to open", async () => {
    const cls = await makeClass({
      maxStudents: 2,
      enrolledStudents: [studentId, otherStudentId],
      status: "full",
    });

    const removed = await unenrollStudentFromClass(cls._id.toString(), studentId.toString());

    expect(removed).toBe(true);
    const updated = await Class.findById(cls._id).lean();
    expect(updated?.enrolledStudents.map(String)).toEqual([otherStudentId.toString()]);
    expect(updated?.status).toBe("open");
  });

  it("keeps a completed class completed after unenrolling", async () => {
    const cls = await makeClass({
      maxStudents: 1,
      enrolledStudents: [studentId],
      status: "completed",
    });

    const removed = await unenrollStudentFromClass(cls._id, studentId);

    expect(removed).toBe(true);
    const updated = await Class.findById(cls._id).lean();
    expect(updated?.status).toBe("completed");
    expect(updated?.enrolledStudents).toHaveLength(0);
  });

  it("keeps a cancelled class cancelled after unenrolling", async () => {
    const cls = await makeClass({
      maxStudents: 1,
      enrolledStudents: [studentId],
      status: "cancelled",
    });

    await unenrollStudentFromClass(cls._id, studentId);

    expect((await Class.findById(cls._id).lean())?.status).toBe("cancelled");
  });

  it("returns false when the student is not enrolled", async () => {
    const cls = await makeClass({ enrolledStudents: [otherStudentId] });

    const removed = await unenrollStudentFromClass(cls._id, studentId);

    expect(removed).toBe(false);
    const updated = await Class.findById(cls._id).lean();
    expect(updated?.enrolledStudents.map(String)).toEqual([otherStudentId.toString()]);
  });

  it("returns false when the class does not exist", async () => {
    const removed = await unenrollStudentFromClass(new mongoose.Types.ObjectId(), studentId);
    expect(removed).toBe(false);
  });
});
