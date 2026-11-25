import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import kk from "../../messages/kk.json";
import ru from "../../messages/ru.json";
import { formatKzt, hasLocale, negotiateLocale } from "@/i18n/config";

/** Список путей ключей словаря; для массивов учитывается длина. */
function shape(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return [`${path}[${value.length}]`, ...value.flatMap((item, i) => shape(item, `${path}[${i}]`))];
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k));
  }
  return [path];
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("dictionaries", () => {
  it("kk and en have exactly the same keys as ru", () => {
    expect(shape(kk)).toEqual(shape(ru));
    expect(shape(en)).toEqual(shape(ru));
  });

  it.each([
    ["kk", kk],
    ["ru", ru],
    ["en", en],
  ])("%s has no empty strings", (_, dict) => {
    expect(strings(dict).filter((s) => s.trim() === "")).toEqual([]);
  });

  it("kk dictionary is written in Kazakh (uses Kazakh-specific letters)", () => {
    const text = strings(kk).join(" ");
    for (const letter of ["ә", "ғ", "қ", "ң", "ө", "ұ", "ү", "і"]) {
      expect(text).toContain(letter);
    }
  });
});

describe("negotiateLocale", () => {
  it.each([
    [null, "ru"],
    ["", "ru"],
    ["kk-KZ,kk;q=0.9,ru;q=0.8", "kk"],
    ["ru-RU,ru;q=0.9,en;q=0.8", "ru"],
    ["en-US,en;q=0.9", "en"],
    ["de-DE,de;q=0.9,en;q=0.5", "en"],
    ["ru;q=0.5,kk;q=0.9", "kk"],
    ["kk;q=0,en", "en"],
    ["fr,de", "ru"],
  ])("%s -> %s", (header, expected) => {
    expect(negotiateLocale(header)).toBe(expected);
  });

  it("validates locales strictly", () => {
    expect(hasLocale("kk")).toBe(true);
    expect(hasLocale("KK")).toBe(false);
    expect(hasLocale("kz")).toBe(false);
    expect(hasLocale(undefined)).toBe(false);
  });
});

describe("formatKzt", () => {
  it.each(["kk", "ru", "en"] as const)("formats tenge without fractions in %s", (locale) => {
    const text = formatKzt(1990, locale);
    expect(text).toMatch(/1[\s  ,.]?990/);
    expect(text).toMatch(/₸|KZT|тг/);
  });
});
