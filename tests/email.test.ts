import { describe, expect, it } from "vitest";
import { escapeHtml, multilingualEmail } from "@/lib/email";

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<img src=x onerror="alert('xss')">&`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;&amp;"
    );
  });

  it("leaves plain text (including Arabic) untouched", () => {
    expect(escapeHtml("مرحباً Ahmed")).toBe("مرحباً Ahmed");
  });
});

describe("multilingualEmail", () => {
  /** Minimal three-language input reused by the cases below. */
  const parts = {
    ar: { subject: "فصلك يبدأ قريباً", body: "<h2>عربي</h2>" },
    en: { subject: "Your class starts soon", body: "<h2>English</h2>" },
    ru: { subject: "Ваше занятие скоро начнётся", body: "<h2>Русский</h2>" },
  };

  it("joins the three subjects with a pipe in Arabic, English, Russian order", () => {
    const { subject } = multilingualEmail(parts);

    expect(subject).toBe(
      "فصلك يبدأ قريباً | Your class starts soon | Ваше занятие скоро начнётся"
    );
  });

  it("appends the suffix once after an em dash", () => {
    const { subject } = multilingualEmail({ ...parts, suffix: "Quran 101" });

    expect(subject).toBe(
      "فصلك يبدأ قريباً | Your class starts soon | Ваше занятие скоро начнётся — Quran 101"
    );
    // A single suffix keeps the subject scannable; repeating it per language
    // would triple the length in the client's preview line.
    expect(subject.match(/Quran 101/g)).toHaveLength(1);
  });

  it("omits the em dash entirely when no suffix is given", () => {
    expect(multilingualEmail(parts).subject).not.toContain("—");
  });

  it("omits the em dash when the suffix is an empty string", () => {
    // Callers pass e.g. a class title straight through; an empty title must
    // not leave a dangling dash at the end of the subject.
    expect(multilingualEmail({ ...parts, suffix: "" }).subject).not.toContain("—");
  });

  it("wraps the Arabic block right-to-left and the Latin/Cyrillic blocks left-to-right", () => {
    const { html } = multilingualEmail(parts);

    expect(html).toContain('<div dir="rtl"><h2>عربي</h2></div>');
    expect(html).toContain('<div dir="ltr"><h2>English</h2></div>');
    expect(html).toContain('<div dir="ltr"><h2>Русский</h2></div>');
  });

  it("separates the three blocks with a horizontal rule", () => {
    const { html } = multilingualEmail(parts);

    // Two rules for three blocks — a trailing rule would render as a stray
    // line at the bottom of the email.
    expect(html.match(/<hr \/>/g)).toHaveLength(2);
  });

  it("orders the blocks Arabic, English, Russian", () => {
    const { html } = multilingualEmail(parts);

    expect(html.indexOf("عربي")).toBeLessThan(html.indexOf("English"));
    expect(html.indexOf("English")).toBeLessThan(html.indexOf("Русский"));
  });

  it("passes body HTML through unmodified so callers keep control of markup", () => {
    const body = `<p>Hi <strong>Ahmed &amp; Co</strong></p><p><a href="https://x/y?a=1&amp;b=2">Join</a></p>`;
    const { html } = multilingualEmail({ ...parts, en: { subject: "s", body } });

    expect(html).toContain(body);
  });
});
