import mongoose from "mongoose";
import { AssignmentSubmission } from "@/models/AssignmentSubmission";

export interface CurriculumSyncItem {
  sessionNumber: number;
  assignmentTitle: string;
  maxMarks: number;
}

/**
 * Propagates curriculum edits to existing assignment submissions of a class.
 *
 * For each curriculum item, all submissions of `classId` with the same
 * `sessionNumber` get their denormalized `assignmentTitle` and `maxMarks`
 * refreshed. Grading fields (`mark`, `status`, `feedback`) are untouched, and
 * submissions whose sessionNumber is no longer in the curriculum are left
 * as-is so grades are preserved.
 *
 * Returns the number of submissions updated.
 */
export async function syncSubmissionsWithCurriculum(
  classId: string | mongoose.Types.ObjectId,
  curriculum: CurriculumSyncItem[]
): Promise<number> {
  if (curriculum.length === 0) return 0;

  const classObjectId = new mongoose.Types.ObjectId(classId);
  const result = await AssignmentSubmission.bulkWrite(
    curriculum.map((item) => ({
      updateMany: {
        filter: { classId: classObjectId, sessionNumber: item.sessionNumber },
        update: {
          $set: {
            assignmentTitle: item.assignmentTitle,
            maxMarks: item.maxMarks,
          },
        },
      },
    })),
    { ordered: false }
  );
  return result.modifiedCount;
}
