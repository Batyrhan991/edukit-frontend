import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Проверка контраста токенов Ocean Blue по формуле WCAG 2.2.
 * Источник значений — src/app/globals.css, чтобы тест не расходился с реальными стилями.
 */
const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

function readTokens(selector: string): Record<string, string> {
  const block = css.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`))?.[1];
  if (!block) throw new Error(`Block ${selector} not found`);
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Пары «текст на фоне» — минимум 4.5:1.
const textPairs: [string, string][] = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["primary", "background"],
  ["primary", "card"],
];

// Нетекстовые элементы (границы полей, кольцо фокуса) — минимум 3:1.
const uiPairs: [string, string][] = [
  ["input", "background"],
  ["input", "card"],
  ["ring", "background"],
  ["ring", "card"],
];

describe.each([":root", ".dark"])("Ocean Blue tokens in %s", (selector) => {
  const tokens = readTokens(selector);

  it.each(textPairs)("text %s on %s ≥ 4.5:1", (fg, bg) => {
    expect(tokens[fg], fg).toBeDefined();
    expect(tokens[bg], bg).toBeDefined();
    expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(uiPairs)("UI %s on %s ≥ 3:1", (fg, bg) => {
    expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(3);
  });
});

describe("brand palette from the spec", () => {
  it("light theme uses the approved Ocean Blue colors", () => {
    const light = readTokens(":root");
    expect(light.primary.toLowerCase()).toBe("#2563eb");
    expect(light.secondary.toLowerCase()).toBe("#dbeafe");
    expect(light.background.toLowerCase()).toBe("#f8fafc");
    expect(light.foreground.toLowerCase()).toBe("#0f172a");
  });

  it("dark theme uses the approved accent #60A5FA as primary", () => {
    expect(readTokens(".dark").primary.toLowerCase()).toBe("#60a5fa");
  });

  it("corner radius stays within 0–4 px", () => {
    const radii = [...css.matchAll(/--radius[\w-]*:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(radii.length).toBeGreaterThan(0);
    expect(Math.max(...radii)).toBeLessThanOrEqual(4);
  });
});
