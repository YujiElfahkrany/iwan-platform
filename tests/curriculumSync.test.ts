import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { AssignmentSubmission } from "@/models/AssignmentSubmission";
import { syncSubmissionsWithCurriculum } from "@/lib/curriculumSync";

let mongod: MongoMemoryServer;

const classA = new mongoose.Types.ObjectId();
const classB = new mongoose.Types.ObjectId();
const student = new mongoose.Types.ObjectId();

function makeSubmission(overrides: Partial<{
  classId: mongoose.Types.ObjectId;
  sessionNumber: number;
  assignmentTitle: string;
  maxMarks: number;
  status: "pending" | "approved" | "rejected";
  mark: number;
  feedback: string;
}> = {}) {
  return AssignmentSubmission.create({
    classId: classA,
    studentId: student,
    sessionNumber: 1,
    assignmentTitle: "Old Title",
    maxMarks: 10,
    fileData: "data:application/pdf;base64,AAAA",
    fileName: "homework.pdf",
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
  await AssignmentSubmission.deleteMany({});
});

describe("syncSubmissionsWithCurriculum", () => {
  it("updates title and maxMarks of submissions matching a curriculum session", async () => {
    await makeSubmission({ sessionNumber: 1 });
    await makeSubmission({ sessionNumber: 1 });

    await syncSubmissionsWithCurriculum(classA, [
      { sessionNumber: 1, assignmentTitle: "New Title", maxMarks: 25 },
    ]);

    const subs = await AssignmentSubmission.find({ classId: classA }).lean();
    expect(subs).toHaveLength(2);
    for (const s of subs) {
      expect(s.assignmentTitle).toBe("New Title");
      expect(s.maxMarks).toBe(25);
    }
  });

  it("does not touch submissions of other classes with the same sessionNumber", async () => {
    await makeSubmission({ classId: classB, sessionNumber: 1, assignmentTitle: "Class B Title", maxMarks: 5 });

    await syncSubmissionsWithCurriculum(classA, [
      { sessionNumber: 1, assignmentTitle: "New Title", maxMarks: 25 },
    ]);

    const other = await AssignmentSubmission.findOne({ classId: classB }).lean();
    expect(other?.assignmentTitle).toBe("Class B Title");
    expect(other?.maxMarks).toBe(5);
  });

  it("preserves mark, status and feedback on updated submissions", async () => {
    await makeSubmission({ sessionNumber: 2, status: "approved", mark: 8, feedback: "Well done" });

    await syncSubmissionsWithCurriculum(classA, [
      { sessionNumber: 2, assignmentTitle: "Renamed", maxMarks: 20 },
    ]);

    const sub = await AssignmentSubmission.findOne({ classId: classA, sessionNumber: 2 }).lean();
    expect(sub?.assignmentTitle).toBe("Renamed");
    expect(sub?.maxMarks).toBe(20);
    expect(sub?.status).toBe("approved");
    expect(sub?.mark).toBe(8);
    expect(sub?.feedback).toBe("Well done");
  });

  it("leaves submissions unchanged when their sessionNumber was removed from the curriculum", async () => {
    await makeSubmission({ sessionNumber: 3, assignmentTitle: "Removed Session", maxMarks: 15 });

    const updated = await syncSubmissionsWithCurriculum(classA, [
      { sessionNumber: 1, assignmentTitle: "Session 1", maxMarks: 10 },
    ]);

    expect(updated).toBe(0);
    const sub = await AssignmentSubmission.findOne({ classId: classA, sessionNumber: 3 }).lean();
    expect(sub?.assignmentTitle).toBe("Removed Session");
    expect(sub?.maxMarks).toBe(15);
  });

  it("returns the number of updated submissions", async () => {
    await makeSubmission({ sessionNumber: 1 });
    await makeSubmission({ sessionNumber: 1 });
    await makeSubmission({ sessionNumber: 2 });
    await makeSubmission({ classId: classB, sessionNumber: 1 });

    const updated = await syncSubmissionsWithCurriculum(classA.toString(), [
      { sessionNumber: 1, assignmentTitle: "T1", maxMarks: 11 },
      { sessionNumber: 2, assignmentTitle: "T2", maxMarks: 12 },
    ]);

    expect(updated).toBe(3);
  });
});
