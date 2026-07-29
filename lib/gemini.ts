// Server-only boundary to the Gemini API. Everything here is I/O against
// Google, so it carries no decisions of its own — the prompt and the parsing of
// the answer live in lib/sessionNotes.ts, the batching in lib/sessionNotesSweep.ts.
// Keep it thin: this file is not unit-testable without a real API key.
import { PLATFORM_LOCALES } from "@/lib/captions";

/**
 * Free tier for this model: 10 requests/minute, 250 requests/day.
 * If the daily cap is ever the binding limit, switch to
 * "gemini-2.5-flash-lite" (same request shape, higher requests/day allowance).
 */
const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/** Forces the answer into the trilingual note shape parseNotesResponse expects. */
const NOTES_SCHEMA = {
  type: "object",
  properties: Object.fromEntries(PLATFORM_LOCALES.map((locale) => [locale, { type: "string" }])),
  required: [...PLATFORM_LOCALES],
};

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Ask Gemini for one session's notes. Returns the model's raw text payload for
 * parseNotesResponse to validate. Throws on any transport, quota or shape
 * problem so the caller can count the attempt instead of storing junk notes.
 */
export async function generateSessionNotes(prompt: string): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini is not configured: set GEMINI_API_KEY");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: NOTES_SCHEMA,
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 500);
    throw new Error(`Gemini generateContent failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    // Happens on a safety block or an empty candidate list; surfacing it keeps
    // the retry counter honest rather than pretending we got notes.
    throw new Error("Gemini generateContent returned no text candidate");
  }
  return text;
}
