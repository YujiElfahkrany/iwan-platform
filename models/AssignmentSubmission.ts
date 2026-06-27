import mongoose, { Schema, model, models } from "mongoose";

export interface IAssignmentSubmission {
  _id: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  sessionNumber: number;
  assignmentTitle: string;
  maxMarks: number;
  fileData: string;
  fileName: string;
  status: "pending" | "approved" | "rejected";
  mark?: number;
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSubmissionSchema = new Schema<IAssignmentSubmission>(
  {
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sessionNumber: { type: Number, required: true },
    assignmentTitle: { type: String, required: true },
    maxMarks: { type: Number, required: true },
    fileData: { type: String, required: true },
    fileName: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    mark: { type: Number },
    feedback: { type: String },
  },
  { timestamps: true }
);

AssignmentSubmissionSchema.index({ classId: 1, studentId: 1 });
AssignmentSubmissionSchema.index({ classId: 1, status: 1 });

if (process.env.NODE_ENV !== "production" && models.AssignmentSubmission) {
  delete (models as Record<string, unknown>).AssignmentSubmission;
}
export const AssignmentSubmission =
  models.AssignmentSubmission ??
  model<IAssignmentSubmission>("AssignmentSubmission", AssignmentSubmissionSchema);
