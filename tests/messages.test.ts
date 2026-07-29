import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import ru from "@/messages/ru.json";

const catalogs: Record<string, Record<string, Record<string, string>>> = {
  en,
  ar,
  ru,
};

/** Flattens {section: {key: value}} into ["section.key", value] pairs. */
function flatten(catalog: Record<string, Record<string, string>>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [section, keys] of Object.entries(catalog)) {
    for (const [key, value] of Object.entries(keys)) {
      out.set(`${section}.${key}`, value);
    }
  }
  return out;
}

/** ICU placeholders like {name} — must match across translations or next-intl throws at render. */
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("message catalogs", () => {
  it("every routing locale has a message catalog", () => {
    for (const locale of routing.locales) {
      expect(catalogs[locale], `missing messages/${locale}.json import`).toBeDefined();
    }
  });

  it("all catalogs contain exactly the same keys as en", () => {
    const enKeys = [...flatten(en).keys()].sort();
    for (const [locale, catalog] of Object.entries(catalogs)) {
      if (locale === "en") continue;
      expect([...flatten(catalog).keys()].sort(), `key mismatch in ${locale}`).toEqual(enKeys);
    }
  });

  it("translations keep the same ICU placeholders as en", () => {
    const enFlat = flatten(en);
    for (const [locale, catalog] of Object.entries(catalogs)) {
      if (locale === "en") continue;
      for (const [key, value] of flatten(catalog)) {
        expect(
          placeholders(value),
          `placeholder mismatch in ${locale}: ${key}`
        ).toEqual(placeholders(enFlat.get(key) ?? ""));
      }
    }
  });

  it("no translation is an empty string", () => {
    for (const [locale, catalog] of Object.entries(catalogs)) {
      for (const [key, value] of flatten(catalog)) {
        expect(value.trim(), `${locale}: ${key} is empty`).not.toBe("");
      }
    }
  });
});
