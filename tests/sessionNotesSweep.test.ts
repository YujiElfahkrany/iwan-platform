// Sweep tests run against a real in-memory Mongo and an in-memory fake of the
// injected model call (repo convention: dependency injection, no vi.mock).
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ISessionTranscript, SessionTranscript } from "@/models/SessionTranscript";
import { MAX_NOTES_PER_RUN, sweepSessionNotes } from "@/lib/sessionNotesSweep";
import { MAX_NOTE_ATTEMPTS, NOTE_QUIET_PERIOD_MS } from "@/lib/sessionNotes";

let mongod: MongoMemoryServer;

const now = new Date("2026-07-29T12:00:00Z");
const quietDate = new Date(now.getTime() - NOTE_QUIET_PERIOD_MS - 1000);

const NOTE = { en: "Covered verbs.", ar: "تمت تغطية الأفعال.", ru: "Прошли глаголы." };

// Channels must differ: {channel, dateKey} is unique, and these fixtures all
// share one date.
let channelCounter = 0;

function makeTranscript(overrides: Partial<ISessionTranscript> = {}) {
  channelCounter += 1;
  return SessionTranscript.create({
    channel: `iwan-class-${channelCounter}`,
    classId: new mongoose.Types.ObjectId(),
    dateKey: "2026-07-29",
    lines: [
      { at: quietDate, name: "Sara", lang: "ar-SA", text: "نبدأ الدرس" },
      { at: quietDate, name: "Ali", lang: "en-US", text: "Today we cover verbs" },
      { at: quietDate, name: "Sara", lang: "ar-SA", text: "الواجب: صفحة ٥" },
    ],
    lastLineAt: quietDate,
    noteStatus: "pending",
    noteAttempts: 0,
    ...overrides,
  });
}

/** In-memory model fake: replies per call, or throws for the listed channels. */
function makeFakeGenerator(behaviour: { reply?: unknown; throwFor?: string[] } = {}) {
  const prompts: string[] = [];
  const deps = {
    async generate(prompt: string) {
      prompts.push(prompt);
      if (behaviour.throwFor?.some((needle) => prompt.includes(needle))) {
        throw new Error("gemini down");
      }
      // undefined is not a meaningful reply here, so default to valid notes.
      return behaviour.reply === undefined ? JSON.stringify(NOTE) : behaviour.reply;
    },
  };
  return { deps, prompts };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await SessionTranscript.deleteMany({});
});

describe("sweepSessionNotes", () => {
  it("stores trilingual notes for a finished session", async () => {
    const rec = await makeTranscript();
    const { deps, prompts } = makeFakeGenerator();

    const result = await sweepSessionNotes(deps, now);

    expect(result).toEqual({ generated: 1, failed: 0, skipped: 0 });
    const updated = await SessionTranscript.findById(rec._id).lean();
    expect(updated?.noteStatus).toBe("done");
    expect(updated?.note).toMatchObject(NOTE);
    expect(updated?.noteGeneratedAt).toEqual(now);
    expect(prompts[0]).toContain("Today we cover verbs"); // the transcript reached the model
  });

  it("discards the verbatim transcript once its notes are stored", async () => {
    // The summary is what participants read, so the raw speech is not kept:
    // it bounds collection growth and limits how much of a lesson is retained.
    const rec = await makeTranscript();
    const { deps } = makeFakeGenerator();

    await sweepSessionNotes(deps, now);

    const updated = await SessionTranscript.findById(rec._id).lean();
    expect(updated?.lines).toEqual([]);
    expect(updated?.note).toMatchObject(NOTE);
  });

  it("keeps the transcript when notes could not be generated yet", async () => {
    // Retries need the lines, so they must survive a failed attempt.
    const rec = await makeTranscript();
    const { deps } = makeFakeGenerator({ reply: "not json" });

    await sweepSessionNotes(deps, now);

    const updated = await SessionTranscript.findById(rec._id).lean();
    expect(updated?.lines).toHaveLength(3);
  });

  it("keeps a transcript pending and counts the attempt when the reply is unparseable", async () => {
    const rec = await makeTranscript();
    const { deps } = makeFakeGenerator({ reply: "Sure, here are your notes!" });

    const result = await sweepSessionNotes(deps, now);

    expect(result).toEqual({ generated: 0, failed: 0, skipped: 0 });
    const updated = await SessionTranscript.findById(rec._id).lean();
    expect(updated?.noteStatus).toBe("pending");
    expect(updated?.noteAttempts).toBe(1);
    expect(updated?.note).toBeUndefined();
  });

  it("gives up on the transcript once the attempt cap is reached", async () => {
    const rec = await makeTranscript({ noteAttempts: MAX_NOTE_ATTEMPTS - 1 });
    const { deps } = makeFakeGenerator({ reply: "{}" });

    const result = await sweepSessionNotes(deps, now);

    expect(result).toEqual({ generated: 0, failed: 1, skipped: 0 });
    const updated = await SessionTranscript.findById(rec._id).lean();
    expect(updated?.noteStatus).toBe("failed");
    expect(updated?.noteAttempts).toBe(MAX_NOTE_ATTEMPTS);
  });

  it("never picks up a transcript that already gave up", async () => {
    await makeTranscript({ noteStatus: "failed", noteAttempts: MAX_NOTE_ATTEMPTS });
    const { deps, prompts } = makeFakeGenerator();

    const result = await sweepSessionNotes(deps, now);

    expect(result).toEqual({ generated: 0, failed: 0, skipped: 0 });
    expect(prompts).toEqual([]);
  });

  it("contains a throwing model call so the other transcripts still get notes", async () => {
    const broken = await makeTranscript({
      lines: [
        { at: quietDate, name: "Sara", lang: "ar-SA", text: "POISON" },
        { at: quietDate, name: "Ali", lang: "en-US", text: "second" },
        { at: quietDate, name: "Ali", lang: "en-US", text: "third" },
      ],
    });
    const healthy = await makeTranscript();
    const { deps } = makeFakeGenerator({ throwFor: ["POISON"] });

    const result = await sweepSessionNotes(deps, now);

    expect(result).toEqual({ generated: 1, failed: 0, skipped: 0 });
    expect((await SessionTranscript.findById(broken._id).lean())?.noteAttempts).toBe(1);
    expect((await SessionTranscript.findById(healthy._id).lean())?.noteStatus).toBe("done");
  });

  it("leaves a session that is still running untouched", async () => {
    const fresh = await makeTranscript({ lastLineAt: now });
    const { deps, prompts } = makeFakeGenerator();

    const result = await sweepSessionNotes(deps, now);

    expect(result).toEqual({ generated: 0, failed: 0, skipped: 0 });
    expect(prompts).toEqual([]);
    expect((await SessionTranscript.findById(fresh._id).lean())?.noteStatus).toBe("pending");
  });

  it("skips a transcript too short to be a real session", async () => {
    await makeTranscript({ lines: [{ at: quietDate, name: "Sara", lang: "ar-SA", text: "hello" }] });
    const { deps, prompts } = makeFakeGenerator();

    const result = await sweepSessionNotes(deps, now);

    expect(result).toEqual({ generated: 0, failed: 0, skipped: 1 });
    expect(prompts).toEqual([]);
  });

  it("caps model calls per run and defers the rest", async () => {
    // The free tier allows 10 requests/minute, so a backlog must drain over
    // several runs instead of one burst.
    for (let i = 0; i < MAX_NOTES_PER_RUN + 3; i++) await makeTranscript();
    const { deps, prompts } = makeFakeGenerator();

    const result = await sweepSessionNotes(deps, now);

    expect(result).toEqual({ generated: MAX_NOTES_PER_RUN, failed: 0, skipped: 3 });
    expect(prompts).toHaveLength(MAX_NOTES_PER_RUN);
    expect(await SessionTranscript.countDocuments({ noteStatus: "pending" })).toBe(3);
  });

  it("processes the transcripts that have waited longest first", async () => {
    const older = await makeTranscript({
      lastLineAt: new Date(quietDate.getTime() - 60 * 60 * 1000),
      lines: [
        { at: quietDate, name: "Sara", lang: "ar-SA", text: "OLDEST" },
        { at: quietDate, name: "Ali", lang: "en-US", text: "second" },
        { at: quietDate, name: "Ali", lang: "en-US", text: "third" },
      ],
    });
    await makeTranscript();
    const { deps, prompts } = makeFakeGenerator();

    await sweepSessionNotes(deps, now);

    expect(prompts[0]).toContain("OLDEST");
    expect((await SessionTranscript.findById(older._id).lean())?.noteStatus).toBe("done");
  });
});
