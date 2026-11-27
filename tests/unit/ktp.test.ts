import { describe, expect, it } from "vitest";
import { byQuarter, lessonDate, validateKtpForm, type KtpPlan } from "@/lib/ktp";
import { ktpDoc, periodLabel } from "@/lib/ktp-doc";
import type { DocNode } from "@/lib/ksp-doc";
import en from "../../messages/en.json";
import kk from "../../messages/kk.json";
import ru from "../../messages/ru.json";

const plan: KtpPlan = {
  title: "КТП: Русская литература, 7 класс",
  subject: "Русская литература",
  grade: "7",
  academicYear: "2026-2027",
  period: "year",
  rows: [
    { number: 1, quarter: 1, date: "2026-09-03", section: "Притчи", topic: "Притча о блудном сыне", objectives: ["7.1.1.1"], hours: 1, notes: null },
    { number: 2, quarter: 1, date: "2026-09-07", section: "Притчи", topic: "<script>alert(1)</script>", objectives: [], hours: 1, notes: "СОР" },
    { number: 3, quarter: 2, date: "2026-11-02", section: "Рассказы", topic: "Телеграмма", objectives: ["7.2.1.1", "7.2.1.2"], hours: 1, notes: null },
  ],
  sources: [{ id: "src-1", title: "Типовая программа, 7 класс" }],
  warnings: [],
};

const allowed = new Set(["doc", "paragraph", "text", "heading", "bulletList", "listItem", "table", "tableRow", "tableHeader", "tableCell"]);
function walk(node: DocNode, visit: (n: DocNode) => void) {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

describe("ktp", () => {
  it("validates the form like the server", () => {
    const form = { subject: "Физика", grade: "8", academicYear: "2026-2027", period: "q1" as const, weekdays: [1, 3], notes: "", language: "ru" as const };
    expect(validateKtpForm(form)).toEqual({});
    expect(validateKtpForm({ ...form, subject: " ", weekdays: [] })).toEqual({ subject: "required", weekdays: "invalid" });
    expect(validateKtpForm({ ...form, weekdays: [1, 2, 3, 4, 5, 6] }).weekdays).toBe("invalid");
  });

  it("formats dates without time-zone shifts and groups by quarter", () => {
    expect(lessonDate("2026-09-03")).toBe("03.09.2026");
    expect(byQuarter(plan.rows).map((g) => [g.quarter, g.rows.length])).toEqual([[1, 2], [2, 1]]);
    expect(periodLabel("q3", ru.ktp)).toBe("3 четверть");
    expect(periodLabel("year", kk.ktp)).toBe("Бүкіл оқу жылы");
  });

  it("builds an editor document with one table per quarter and text only", () => {
    const doc = ktpDoc(plan, ru.ktp);
    const tables = doc.content!.filter((n) => n.type === "table");
    expect(tables).toHaveLength(2);
    expect(tables[0].content).toHaveLength(3); // заголовок + 2 урока
    const texts: string[] = [];
    walk(doc, (n) => {
      expect(allowed.has(n.type)).toBe(true);
      if (n.type === "text" && typeof n.text === "string") texts.push(n.text);
    });
    expect(texts).toContain("03.09.2026");
    expect(texts).toContain("<script>alert(1)</script>"); // как текст, а не разметка
    expect(texts).toContain("7.2.1.1, 7.2.1.2");
    expect(texts).toContain("Всего часов: 3");
  });

  it("has the same KTP keys in every language", () => {
    expect(Object.keys(kk.ktp).sort()).toEqual(Object.keys(ru.ktp).sort());
    expect(Object.keys(en.ktp).sort()).toEqual(Object.keys(ru.ktp).sort());
    expect(Object.keys(en.ktp.errors).sort()).toEqual(Object.keys(ru.ktp.errors).sort());
  });
});
