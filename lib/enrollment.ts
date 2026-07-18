import mongoose from "mongoose";
import { Class, IClass } from "@/models/Class";

const ENROLLABLE_STATUSES = ["open", "full"] as const;

export interface EnrollResult {
  enrolled: boolean;
  class?: IClass;
}

/**
 * Atomically enrolls a student in a class.
 *
 * The capacity check and the roster insertion happen in a single
 * `findOneAndUpdate`, so concurrent enrollments can never overbook.
 * Enrolling a student who is already on the roster succeeds without
 * duplicating them. Classes that are "completed" or "cancelled" (or at
 * capacity, or missing) are rejected.
 */
export async function enrollStudentInClass(
  classId: string | mongoose.Types.ObjectId,
  studentId: string | mongoose.Types.ObjectId
): Promise<EnrollResult> {
  const sid = new mongoose.Types.ObjectId(studentId);

  const updated = await Class.findOneAndUpdate(
    {
      _id: classId,
      status: { $in: ENROLLABLE_STATUSES },
      $expr: { $lt: [{ $size: "$enrolledStudents" }, "$maxStudents"] },
    },
    { $addToSet: { enrolledStudents: sid } },
    { returnDocument: "after" }
  );

  if (!updated) {
    // A class at capacity fails the size filter even when the student is
    // already enrolled — treat that as an idempotent success.
    const existing = await Class.findOne({
      _id: classId,
      status: { $in: ENROLLABLE_STATUSES },
      enrolledStudents: sid,
    });
    return existing ? { enrolled: true, class: existing } : { enrolled: false };
  }

  if (updated.enrolledStudents.length >= updated.maxStudents) {
    await Class.updateOne({ _id: updated._id, status: "open" }, { $set: { status: "full" } });
    updated.status = "full";
  }

  return { enrolled: true, class: updated };
}

/**
 * Removes a student from a class roster.
 *
 * A "full" class is reopened only when the roster drops below capacity;
 * "completed" and "cancelled" classes keep their status.
 *
 * @returns whether the student was actually removed.
 */
export async function unenrollStudentFromClass(
  classId: string | mongoose.Types.ObjectId,
  studentId: string | mongoose.Types.ObjectId
): Promise<boolean> {
  const sid = new mongoose.Types.ObjectId(studentId);

  const updated = await Class.findOneAndUpdate(
    { _id: classId, enrolledStudents: sid },
    { $pull: { enrolledStudents: sid } },
    { returnDocument: "after" }
  );
  if (!updated) return false;

  await Class.updateOne(
    {
      _id: updated._id,
      status: "full",
      $expr: { $lt: [{ $size: "$enrolledStudents" }, "$maxStudents"] },
    },
    { $set: { status: "open" } }
  );

  return true;
}

/**
 * Removes a student from every class they are enrolled in.
 * Classes that were "full" and now have room again are reopened;
 * "completed" and "cancelled" classes keep their status.
 *
 * @returns the number of classes the student was removed from.
 */
export async function removeStudentFromClasses(
  studentId: string | mongoose.Types.ObjectId
): Promise<number> {
  const id = new mongoose.Types.ObjectId(studentId);

  const affected = await Class.find({ enrolledStudents: id }).select("_id").lean();
  if (affected.length === 0) return 0;

  const classIds = affected.map((c) => c._id);
  await Class.updateMany({ _id: { $in: classIds } }, { $pull: { enrolledStudents: id } });

  await Class.updateMany(
    {
      _id: { $in: classIds },
      status: "full",
      $expr: { $lt: [{ $size: "$enrolledStudents" }, "$maxStudents"] },
    },
    { $set: { status: "open" } }
  );

  return classIds.length;
}
