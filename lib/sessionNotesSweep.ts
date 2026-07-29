// Cron sweep: turns each finished group-class transcript into trilingual notes.
// The model call is injected so the sweep is testable against an in-memory fake
// without mocking (repo convention).
import { SessionTranscript, ISessionTranscript } from "@/models/SessionTranscript";
import {
  MAX_NOTE_ATTEMPTS,
  NOTE_QUIET_PERIOD_MS,
  buildNotesPrompt,
  parseNotesResponse,
  shouldGenerateNote,
} from "@/lib/sessionNotes";

/**
 * Model calls per run. The Gemini free tier allows 10 requests/minute and a run
 * is a single burst, so 8 leaves headroom; anything left over waits for the
 * next run.
 */
export const MAX_NOTES_PER_RUN = 8;

export interface SessionNotesDeps {
  generate(prompt: string): Promise<unknown>;
}

export interface SessionNotesSweepResult {
  generated: number;
  /** Transcripts that exhausted their attempts this run (retries are not counted). */
  failed: number;
  /** Candidates left for a later run, plus anything the rules rejected. */
  skipped: number;
}

/** Count one failed attempt; only the last allowed attempt gives up for good. */
async function recordAttempt(rec: ISessionTranscript): Promise<boolean> {
  const noteAttempts = rec.noteAttempts + 1;
  const exhausted = noteAttempts >= MAX_NOTE_ATTEMPTS;
  await SessionTranscript.updateOne(
    { _id: rec._id },
    { $set: { noteAttempts, noteStatus: exhausted ? "failed" : "pending" } }
  );
  return exhausted;
}

export async function sweepSessionNotes(
  deps: SessionNotesDeps,
  now: Date
): Promise<SessionNotesSweepResult> {
  // Inclusive bound so shouldGenerateNote stays the single authority on the
  // quiet-period boundary; the query only narrows what it has to look at.
  const candidates = await SessionTranscript.find({
    noteStatus: "pending",
    lastLineAt: { $lte: new Date(now.getTime() - NOTE_QUIET_PERIOD_MS) },
    noteAttempts: { $lt: MAX_NOTE_ATTEMPTS },
  })
    .sort({ lastLineAt: 1 })
    .lean<ISessionTranscript[]>();

  const ready = candidates.filter((rec) => shouldGenerateNote(rec, now));
  const batch = ready.slice(0, MAX_NOTES_PER_RUN);
  let generated = 0;
  let failed = 0;

  for (const rec of batch) {
    // One broken transcript must not abort the run: log it, count the attempt,
    // and let the next run retry until the cap.
    try {
      const raw = await deps.generate(buildNotesPrompt(rec.lines));
      const note = parseNotesResponse(raw);
      if (note) {
        // The raw lines are dropped once the summary exists: the notes are the
        // artifact people read, and keeping verbatim speech would grow the
        // collection without bound and retain more of the lesson than needed.
        await SessionTranscript.updateOne(
          { _id: rec._id },
          { $set: { note, noteStatus: "done", noteGeneratedAt: now, lines: [] } }
        );
        generated += 1;
        continue;
      }
      console.error(`session notes unparseable for ${rec._id.toString()}`);
      if (await recordAttempt(rec)) failed += 1;
    } catch (err) {
      console.error(`session notes generation failed for ${rec._id.toString()}`, err);
      try {
        if (await recordAttempt(rec)) failed += 1;
      } catch (writeErr) {
        console.error(`session notes attempt write failed for ${rec._id.toString()}`, writeErr);
      }
    }
  }

  return {
    generated,
    failed,
    skipped: candidates.length - batch.length,
  };
}
