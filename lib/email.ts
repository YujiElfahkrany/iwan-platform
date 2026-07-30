import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const FROM_EMAIL = `Iwan Academy <${process.env.GMAIL_USER}>`;

/** Escapes user-supplied text before interpolating it into email HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** One language's copy for an automated email. */
export interface EmailPart {
  /** Subject line in this language, without any shared suffix. */
  subject: string;
  /**
   * Body HTML in this language. Trusted and inserted verbatim — the caller
   * must run every user-supplied value through `escapeHtml` first.
   */
  body: string;
}

/**
 * Composes one email that carries all three platform languages, because we do
 * not store a language preference per recipient.
 *
 * The subject joins the three language subjects with " | ", optionally followed
 * by a single shared suffix (e.g. a class title) after an em dash. The body
 * stacks the Arabic (right-to-left), English and Russian blocks, separated by
 * horizontal rules.
 */
export function multilingualEmail(parts: {
  ar: EmailPart;
  en: EmailPart;
  ru: EmailPart;
  /** Appended once after the three subjects, e.g. a class title. */
  suffix?: string;
}): { subject: string; html: string } {
  const subjects = [parts.ar.subject, parts.en.subject, parts.ru.subject].join(" | ");
  return {
    subject: parts.suffix ? `${subjects} — ${parts.suffix}` : subjects,
    html: [
      `<div dir="rtl">${parts.ar.body}</div>`,
      `<div dir="ltr">${parts.en.body}</div>`,
      `<div dir="ltr">${parts.ru.body}</div>`,
    ].join("\n<hr />\n"),
  };
}

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  await transporter.sendMail({ from: FROM_EMAIL, ...opts });
}
