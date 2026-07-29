import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { serializeClass } from "@/lib/classResponse";
import { studentClassPrice } from "@/lib/pricing";
import type { IClass } from "@/models/Class";

const TEACHER_ID = new mongoose.Types.ObjectId();
const STUDENT_ID = new mongoose.Types.ObjectId();

function classDoc(overrides: Partial<IClass> = {}): IClass {
  return {
    _id: new mongoose.Types.ObjectId(),
    teacherId: TEACHER_ID,
    title: "Tajweed I",
    description: "",
    subject: "quran",
    startTime: new Date("2026-07-20T18:00:00.000Z"),
    endTime: new Date("2026-07-20T19:00:00.000Z"),
    price: 200,
    maxStudents: 8,
    enrolledStudents: [STUDENT_ID],
    meetingRoomName: "iwan-class-abcd1234",
    status: "open",
    totalSessions: 8,
    curriculum: [],
    daysOfWeek: ["monday"],
    ...overrides,
  };
}

describe("serializeClass", () => {
  it("never exposes the Agora channel", () => {
    // Knowing the channel is enough to subscribe to a room's live captions, so
    // it must not travel with a class listing.
    const json = JSON.stringify(serializeClass(classDoc()));

    expect(json).not.toContain("meetingRoomName");
    expect(json).not.toContain("iwan-class-abcd1234");
  });

  it("renders ids as strings so clients can compare them", () => {
    const cls = classDoc();

    const result = serializeClass(cls);

    expect(result._id).toBe(cls._id.toString());
    expect(result.teacherId).toBe(TEACHER_ID.toString());
    expect(result.enrolledStudents).toEqual([STUDENT_ID.toString()]);
  });

  it("adds the price a student actually pays", () => {
    expect(serializeClass(classDoc({ price: 200 })).studentPrice).toBe(studentClassPrice(200));
  });

  it("keeps the fields the dashboards render", () => {
    const result = serializeClass(classDoc());

    expect(result).toMatchObject({
      title: "Tajweed I",
      subject: "quran",
      status: "open",
      totalSessions: 8,
      maxStudents: 8,
      daysOfWeek: ["monday"],
    });
  });
});
