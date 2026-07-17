import { describe, expect, it } from "vitest";
import { supportWhatsAppUrl } from "@/lib/support";

describe("supportWhatsAppUrl", () => {
  it("routes female users to the female support number", () => {
    expect(supportWhatsAppUrl("female")).toBe("https://wa.me/201555277198");
  });

  it("routes male users to the default support number", () => {
    expect(supportWhatsAppUrl("male")).toBe("https://wa.me/819082272250");
  });

  it("falls back to the default number when gender is unknown", () => {
    expect(supportWhatsAppUrl(undefined)).toBe("https://wa.me/819082272250");
    expect(supportWhatsAppUrl("")).toBe("https://wa.me/819082272250");
  });
});
