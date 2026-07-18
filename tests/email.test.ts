import { describe, expect, it } from "vitest";
import { escapeHtml } from "@/lib/email";

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
