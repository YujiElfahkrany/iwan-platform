import mongoose from "mongoose";
import { Class } from "@/models/Class";

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
