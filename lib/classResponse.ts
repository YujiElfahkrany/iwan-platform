// The one place a Class document is turned into JSON for the HTTP API. Both the
// list endpoint and the single-class endpoint go through it, so the two can
// never drift on what a client is allowed to see.
import type { IClass, ICurriculumItem } from "@/models/Class";
import { studentClassPrice } from "@/lib/pricing";

/**
 * A class as clients see it. The fields are listed one by one rather than spread
 * from the document, so a field added to the Class schema later cannot reach a
 * client until someone adds it here on purpose.
 *
 * Deliberately absent: meetingRoomName. It is the Agora channel, and anyone who
 * learns it can subscribe to that room's live captions — or publish forged ones
 * — because an RTM token is not tied to a channel. Joining a session never needs
 * it from here: /session/[bookingId] reads the booking server-side.
 */
export interface ClassResponse {
  _id: string;
  teacherId: string;
  title: string;
  description: string;
  subject: string;
  startTime: Date;
  endTime: Date;
  price: number;
  /** What a student pays, which is not the teacher's price. */
  studentPrice: number;
  maxStudents: number;
  enrolledStudents: string[];
  status: IClass["status"];
  totalSessions: number;
  curriculum: ICurriculumItem[];
  daysOfWeek: string[];
}

export function serializeClass(cls: IClass): ClassResponse {
  return {
    _id: cls._id.toString(),
    teacherId: cls.teacherId.toString(),
    title: cls.title,
    description: cls.description,
    subject: cls.subject,
    startTime: cls.startTime,
    endTime: cls.endTime,
    price: cls.price,
    studentPrice: studentClassPrice(cls.price),
    maxStudents: cls.maxStudents,
    enrolledStudents: cls.enrolledStudents.map((id) => id.toString()),
    status: cls.status,
    totalSessions: cls.totalSessions,
    curriculum: cls.curriculum,
    daysOfWeek: cls.daysOfWeek,
  };
}
