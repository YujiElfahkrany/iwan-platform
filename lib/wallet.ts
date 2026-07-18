import mongoose from "mongoose";
import { User } from "@/models/User";

type Id = string | mongoose.Types.ObjectId;

function assertValidAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`Invalid amount: ${amount}`);
  }
}

/**
 * Atomically deducts `amount` from the user's balance if it covers the
 * charge. Returns false (and deducts nothing) when the balance is
 * insufficient — safe under concurrent requests.
 */
export async function chargeStudent(userId: Id, amount: number): Promise<boolean> {
  assertValidAmount(amount);
  if (amount === 0) return true;
  const updated = await User.findOneAndUpdate(
    { _id: userId, balance: { $gte: amount } },
    { $inc: { balance: -amount } }
  );
  return updated !== null;
}

/** Atomically credits `amount` back to the user's balance. */
export async function refundStudent(userId: Id, amount: number): Promise<void> {
  assertValidAmount(amount);
  if (amount === 0) return;
  await User.findByIdAndUpdate(userId, { $inc: { balance: amount } });
}
