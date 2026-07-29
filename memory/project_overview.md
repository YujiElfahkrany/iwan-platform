---
name: project-overview
description: iwan-platform — Arabic/English/Russian tutoring platform tech stack, key models, and feature state
metadata:
  type: project
---

Next.js 15 app (app router), MongoDB/Mongoose, next-intl (ar/en/ru, default ar), NextAuth, Agora RTC for video (agora-rtc-react, token endpoint at /api/agora/token — also mints an Agora Signaling/RTM token), Cloudflare R2 (S3 API) for recordings, Gemini for session notes, Tailwind + shadcn/ui.

**Key models:** User, TeacherProfile, StudentProfile, Class (now has totalSessions + curriculum), Booking, Slot, TopUpRequest, AssignmentSubmission, Recording (new), SessionTranscript (new).

**Payment:** Credits-based (LE balance), InstaPay top-up with admin approval.

**Features shipped (2026-06-27):**
- Class creation wizard (2-step): step 1 = class details, step 2 = total sessions + assignments per session (marks).
- AssignmentSubmission model + API routes (`/api/assignments`, `/api/assignments/[id]`).
- Teacher assignments review page (`/dashboard/teacher/assignments`): view submissions, approve/reject with mark + feedback, preview file.
- Student progress page (`/dashboard/student/progress`): see curriculum per enrolled course, upload assignments, view marks.
- Admin delete: DELETE `/api/admin/delete` handles `type: "class"|"user"`, cascades to submissions/profiles/bookings.
- Admin teachers/classes pages now client-side with delete buttons.
- Student bookings and browse-teachers pages fully translated (no hardcoded English).
- All i18n strings in `messages/en.json`, `messages/ar.json`, and `messages/ru.json` (Russian added 2026-07-29; tests/messages.test.ts enforces key parity).

**Features shipped (2026-07-29):**
- **Session recording → R2.** Teacher-only, desktop browsers with webm MediaRecorder. Their browser composites all tiles onto a 1280x720/15 fps canvas + Web Audio mix (`components/video/recordingComposite.ts`), records webm vp8/opus, and PUTs 5 MiB parts to presigned R2 multipart URLs mid-session (`components/video/useSessionRecorder.ts`). Server owns Create/ListParts/Complete/Abort (`lib/r2.ts`); rules + constants in `lib/recording.ts`, DB transitions in `lib/recordingStore.ts`, cron sweep in `lib/recordingSweep.ts`. Routes: `/api/recordings` (start), `/api/recordings/[id]/parts` (URL batch + heartbeat), `/api/recordings/[id]/complete`, `/api/recordings/active` (badge poll, 20 s). Playback: `/[locale]/session/[bookingId]/recordings` + `RecordingsLink` on booking cards. 7-day retention (R2 lifecycle mirrors `RETENTION_DAYS`); recordings are keyed by **channel**, not booking.
- **Live translated captions (free).** Each participant transcribes their own mic (Web Speech API), publishes over Agora Signaling / RTM 2.x on the RTC channel name (`components/video/useRtmChannel.ts`), and translates finals on-device with Chrome's built-in Translator API (`components/video/translator.ts`); senders attach translations so phones only display. Protocol + display logic in `lib/captions.ts` (unit-tested); UI in `CaptionsOverlay.tsx` / `CaptionsMenu.tsx`. Fail-soft: no Signaling / no STT / no translator never affects the call. Opt-in with consent note.
- **AI session notes (group classes only).** Final captions → `/api/transcripts` → `SessionTranscript` keyed by (channel, Cairo dateKey); hourly cron summarizes quiet sessions with `gemini-2.5-flash` into en/ar/ru in one call, then deletes the raw lines (`lib/sessionNotes.ts`, `lib/sessionNotesSweep.ts`, `lib/gemini.ts`). Read via `/api/classes/[id]/notes?locale=` (viewer's language only) and rendered by `components/class/ClassSessionNotes.tsx` on class cards.
- **New env vars:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `GEMINI_API_KEY` (documented in SETUP.md, which also holds the required bucket CORS + 7-day lifecycle rules and the free-tier limits).
- **New crons (vercel.json):** `/api/cron/recordings-sweep` hourly at :00, `/api/cron/session-notes` hourly at :15 — both authorized with `CRON_SECRET`.
- Full write-up: `~/repo/docs/iwan-recording-captions-notes-2026-07-29.md`; decision record: `~/repo/docs/adr/0003-client-side-recording-r2-and-asymmetric-captions.md`.

**Why:** User wants course-style classes with assignment tracking, not just one-off sessions.
