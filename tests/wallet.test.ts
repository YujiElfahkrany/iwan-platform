import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { User } from "@/models/User";
import { chargeStudent, refundStudent } from "@/lib/wallet";

let mongod: MongoMemoryServer;
let userId: mongoose.Types.ObjectId;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  const user = await User.create({
    name: "Student",
    email: "s@example.com",
    passwordHash: "x",
    role: "student",
    status: "approved",
    balance: 100,
  });
  userId = user._id;
});

async function balance(): Promise<number> {
  const user = await User.findById(userId).lean();
  return user!.balance;
}

describe("chargeStudent", () => {
  it("deducts the amount when balance covers it", async () => {
    expect(await chargeStudent(userId, 60)).toBe(true);
    expect(await balance()).toBe(40);
  });

  it("fails without deducting when balance is insufficient", async () => {
    expect(await chargeStudent(userId, 150)).toBe(false);
    expect(await balance()).toBe(100);
  });

  it("never lets sequential charges overdraw the balance", async () => {
    expect(await chargeStudent(userId, 80)).toBe(true);
    expect(await chargeStudent(userId, 80)).toBe(false);
    expect(await balance()).toBe(20);
  });

  it("treats a zero charge as a no-op success", async () => {
    expect(await chargeStudent(userId, 0)).toBe(true);
    expect(await balance()).toBe(100);
  });

  it("rejects negative or non-finite amounts", async () => {
    await expect(chargeStudent(userId, -5)).rejects.toThrow();
    await expect(chargeStudent(userId, NaN)).rejects.toThrow();
  });
});

describe("refundStudent", () => {
  it("credits the amount back", async () => {
    await refundStudent(userId, 25);
    expect(await balance()).toBe(125);
  });

  it("rejects negative or non-finite amounts", async () => {
    await expect(refundStudent(userId, -5)).rejects.toThrow();
    await expect(refundStudent(userId, Infinity)).rejects.toThrow();
  });
});
