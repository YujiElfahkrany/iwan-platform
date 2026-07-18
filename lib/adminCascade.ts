import mongoose from "mongoose";
import { User } from "@/models/User";
import { Class } from "@/models/Class";
import { Booking } from "@/models/Booking";
import { TeacherProfile } from "@/models/TeacherProfile";
import { StudentProfile } from "@/models/StudentProfile";
import { AssignmentSubmission } from "@/models/AssignmentSubmission";
import { Slot } from "@/models/Slot";
import { TopUpRequest } from "@/models/TopUpRequest";
import { removeStudentFromClasses } from "@/lib/enrollment";

type Id = string | mongoose.Types.ObjectId;

/**
 * Deletes a class together with everything that references it:
 * its assignment submissions and any bookings pointing at it.
 */
export async function deleteClassCascade(classId: Id): Promise<void> {
  const id = new mongoose.Types.ObjectId(classId);
  await Promise.all([
    Class.deleteOne({ _id: id }),
    AssignmentSubmission.deleteMany({ classId: id }),
    Booking.deleteMany({ classId: id }),
  ]);
}

/**
 * Deletes all classes owned by a teacher, plus the submissions and
 * bookings referencing those classes (bulk equivalent of running
 * deleteClassCascade per class).
 */
async function deleteTeacherClasses(teacherId: mongoose.Types.ObjectId): Promise<void> {
  const classes = await Class.find({ teacherId }).select("_id").lean();
  const classIds = classes.map((c) => c._id);
  await Promise.all([
    Class.deleteMany({ teacherId }),
    AssignmentSubmission.deleteMany({ classId: { $in: classIds } }),
    Booking.deleteMany({ classId: { $in: classIds } }),
  ]);
}

/**
 * Deletes a user and their role-appropriate related data.
 *
 * - all roles: the user document and their top-up requests.
 * - teacher: profile, bookings keyed by teacherId, their slots, and every
 *   class they own (with that class's submissions and bookings).
 * - student: profile, bookings keyed by studentId, their submissions,
 *   and removal from class rosters (via lib/enrollment).
 */
export async function deleteUserCascade(user: {
  _id: Id;
  role: "student" | "teacher" | "admin";
}): Promise<void> {
  const id = new mongoose.Types.ObjectId(user._id);
  await Promise.all([
    User.deleteOne({ _id: id }),
    TopUpRequest.deleteMany({ userId: id }),
  ]);

  if (user.role === "teacher") {
    await Promise.all([
      TeacherProfile.deleteOne({ userId: id }),
      Booking.deleteMany({ teacherId: id }),
      Slot.deleteMany({ teacherId: id }),
      deleteTeacherClasses(id),
    ]);
  }

  if (user.role === "student") {
    await Promise.all([
      StudentProfile.deleteOne({ userId: id }),
      Booking.deleteMany({ studentId: id }),
      AssignmentSubmission.deleteMany({ studentId: id }),
      removeStudentFromClasses(id),
    ]);
  }
}
