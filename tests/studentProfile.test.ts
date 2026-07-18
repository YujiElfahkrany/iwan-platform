import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { StudentProfile } from "@/models/StudentProfile";

let mongod: MongoMemoryServer;

function makeProfile(overrides: Record<string, unknown> = {}) {
  return StudentProfile.create({
    userId: new mongoose.Types.ObjectId(),
    subjects: [],
    languages: [],
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
  await StudentProfile.deleteMany({});
});

describe("StudentProfile age", () => {
  it("persists the age field", async () => {
    const profile = await makeProfile({ age: 14 });
    const stored = await StudentProfile.findById(profile._id).lean();
    expect(stored?.age).toBe(14);
  });

  it("rejects out-of-range ages", async () => {
    await expect(makeProfile({ age: 2 })).rejects.toThrow();
    await expect(makeProfile({ age: 121 })).rejects.toThrow();
  });

  it("allows profiles without age (existing accounts)", async () => {
    const profile = await makeProfile();
    const stored = await StudentProfile.findById(profile._id).lean();
    expect(stored?.age).toBeUndefined();
  });
});
