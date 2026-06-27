---
name: project-overview
description: iwan-platform — Arabic/English tutoring platform tech stack, key models, and feature state
metadata:
  type: project
---

Next.js 15 app (app router), MongoDB/Mongoose, next-intl (ar/en), NextAuth, Jitsi Meet for video, Tailwind + shadcn/ui.

**Key models:** User, TeacherProfile, StudentProfile, Class (now has totalSessions + curriculum), Booking, Slot, TopUpRequest, AssignmentSubmission (new).

**Payment:** Credits-based (LE balance), InstaPay top-up with admin approval.

**Features shipped (2026-06-27):**
- Class creation wizard (2-step): step 1 = class details, step 2 = total sessions + assignments per session (marks).
- AssignmentSubmission model + API routes (`/api/assignments`, `/api/assignments/[id]`).
- Teacher assignments review page (`/dashboard/teacher/assignments`): view submissions, approve/reject with mark + feedback, preview file.
- Student progress page (`/dashboard/student/progress`): see curriculum per enrolled course, upload assignments, view marks.
- Admin delete: DELETE `/api/admin/delete` handles `type: "class"|"user"`, cascades to submissions/profiles/bookings.
- Admin teachers/classes pages now client-side with delete buttons.
- Student bookings and browse-teachers pages fully translated (no hardcoded English).
- All i18n strings in `messages/en.json` and `messages/ar.json`.

**Why:** User wants course-style classes with assignment tracking, not just one-off sessions.
