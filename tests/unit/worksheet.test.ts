import { describe, expect, it } from "vitest";
import type { DocNode } from "@/lib/ksp-doc";
import { validateWorksheetForm, worksheetKeyDoc, worksheetStudentDoc, type WorksheetDocument } from "@/lib/worksheet";
import en from "../../messages/en.json";
import kk from "../../messages/kk.json";
import ru from "../../messages/ru.json";

const ws: WorksheetDocument = {
  title: "Рабочий лист: Телеграмма",
  subject: "Русская литература",
  grade: "7",
  topic: "Телеграмма",
  theory: "Рассказ — небольшое прозаическое произведение.\nГерои: Настя, Катерина Петровна.",
  tasks: [
    { number: 1, type: "fill", text: "Автор — ___.", options: [], correct: [], answer: "СЕКРЕТ-ПАУСТОВСКИЙ", pairs: [], points: 1, explanation: "" },
    { number: 2, type: "single", text: "Где жила мать?", options: ["В Ленинграде", "В Заборье", "В Москве"], correct: [1], answer: "", pairs: [], points: 1, explanation: "" },
    { number: 3, type: "extended", text: "Почему Настя опоздала?", options: [], correct: [], answer: "СЕКРЕТ-КРИТЕРИИ", pairs: [], points: 3, explanation: "" },
  ],
  reflection: "Что было самым трудным?",
  learningObjectives: [],
  sources: [],
  warnings: [],
};
const labels = { ws: ru.worksheet, quiz: ru.quiz };

function texts(doc: DocNode): string[] {
  const out: string[] = [];
  const walk = (n: DocNode) => {
    if (n.type === "text" && typeof n.text === "string") out.push(n.text);
    for (const c of n.content ?? []) walk(c);
  };
  walk(doc);
  return out;
}

describe("worksheet", () => {
  it("validates the form", () => {
    const form = { subject: "Литература", grade: "7", topic: "Телеграмма", count: "6", difficulty: "medium" as const, theory: true, notes: "", language: "ru" as const };
    expect(validateWorksheetForm(form)).toEqual({});
    expect(validateWorksheetForm({ ...form, count: "13" }).taskCount).toBe("out_of_range");
    expect(validateWorksheetForm({ ...form, topic: "" }).topic).toBe("required");
  });

  it("student sheet has the reminder, tasks and reflection but no answers", () => {
    const all = texts(worksheetStudentDoc(ws, labels, "ru"));
    expect(all).toContain("Вспомни");
    expect(all).toContain("Герои: Настя, Катерина Петровна.");
    expect(all).toContain("Задание 2 (1 б.)");
    expect(all).toContain("Б) В Заборье");
    expect(all).toContain("Что было самым трудным?");
    expect(all.join("\n")).not.toContain("СЕКРЕТ");
  });

  it("key has answers and total points", () => {
    const all = texts(worksheetKeyDoc(ws, labels, "ru")).join("\n");
    expect(all).toContain("Ключ: Рабочий лист: Телеграмма");
    expect(all).toContain("СЕКРЕТ-ПАУСТОВСКИЙ");
    expect(all).toContain("Б) В Заборье");
    expect(all).toContain("Всего баллов: 5");
  });

  it("skips the reminder when there is none and has the same keys in all languages", () => {
    expect(texts(worksheetStudentDoc({ ...ws, theory: "" }, labels, "ru"))).not.toContain("Вспомни");
    expect(Object.keys(kk.worksheet).sort()).toEqual(Object.keys(ru.worksheet).sort());
    expect(Object.keys(en.worksheet).sort()).toEqual(Object.keys(ru.worksheet).sort());
  });
});
