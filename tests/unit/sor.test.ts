import { describe, expect, it } from "vitest";
import type { SorDocument } from "@/lib/api/browser";
import type { DocNode } from "@/lib/ksp-doc";
import { sorKeyDoc, sorTasksDoc } from "@/lib/sor-doc";
import { validateSorForm } from "@/lib/sor";
import kk from "../../messages/kk.json";
import ru from "../../messages/ru.json";

const allowedNodes = new Set(["doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem", "blockquote", "hardBreak", "horizontalRule", "table", "tableRow", "tableHeader", "tableCell"]);

const sor: SorDocument = {
  mode: "sor",
  title: "Суммативное оценивание за раздел «Телеграмма»",
  subject: "Русская литература",
  grade: "7",
  section: "Образы-персонажи в рассказе «Телеграмма»",
  quarter: null,
  durationMinutes: 20,
  learningObjectives: [{ code: "7.2.4.1", text: "характеризовать героев" }],
  assessmentCriteria: ["Обучающийся характеризует героев", "Обучающийся аргументирует позицию"],
  tasks: [
    {
      number: 1,
      text: "Назовите главных героев.\nКто из них живёт в деревне?",
      thinkingLevel: "knowledge",
      criterion: 1,
      points: 2,
      answer: "СЕКРЕТНЫЙ ОТВЕТ: Катерина Петровна, Настя",
      descriptors: [
        { text: "называет героиню", points: 1 },
        { text: "указывает место", points: 1 },
      ],
    },
    {
      number: 2,
      text: "Почему Настя опоздала?",
      thinkingLevel: "higher",
      criterion: 2,
      points: 3,
      answer: "СЕКРЕТНЫЙ ОТВЕТ: занятость",
      descriptors: [{ text: "ДЕСКРИПТОР-КЛЮЧ: приводит довод", points: 3 }],
    },
  ],
  totalPoints: 5,
  sources: [{ id: "kz-order399-app40-ru:standard:7:1:x", title: "Программа, 7 класс" }],
  warnings: [],
};

function texts(node: DocNode): string[] {
  return [...(node.text ? [node.text] : []), ...(node.content ?? []).flatMap(texts)];
}

function nodes(node: DocNode): DocNode[] {
  return [node, ...(node.content ?? []).flatMap(nodes)];
}

describe("SOR documents", () => {
  it("student tasks contain no answers, descriptors or key", () => {
    const all = texts(sorTasksDoc(sor, ru.sor)).join("\n");
    expect(all).toContain("Назовите главных героев.");
    expect(all).toContain("Задание 2 (3 балл(ов))");
    expect(all).toContain("Максимальный балл: 5");
    expect(all).not.toContain("СЕКРЕТНЫЙ ОТВЕТ");
    expect(all).not.toContain("ДЕСКРИПТОР-КЛЮЧ");
    expect(all).not.toContain("Обучающийся характеризует");
  });

  it("teacher key has answers and a full mark scheme table", () => {
    const doc = sorKeyDoc(sor, ru.sor);
    const all = texts(doc).join("\n");
    expect(all).toContain("ключ для учителя");
    expect(all).toContain("СЕКРЕТНЫЙ ОТВЕТ: занятость");
    expect(all).toContain("Навыки высокого порядка");
    const table = nodes(doc).find((n) => n.type === "table")!;
    // Заголовок + по строке на каждый дескриптор.
    expect(table.content).toHaveLength(1 + 3);
    expect(texts(table.content![3]!)).toEqual(["Обучающийся аргументирует позицию", "2", "ДЕСКРИПТОР-КЛЮЧ: приводит довод", "3"]);
  });

  it("uses only nodes the server accepts and labels in the assessment language", () => {
    for (const doc of [sorTasksDoc(sor, kk.sor), sorKeyDoc(sor, kk.sor)]) {
      for (const node of nodes(doc)) expect(allowedNodes.has(node.type)).toBe(true);
      for (const node of nodes(doc)) if (node.type === "text") expect(node.text?.trim()).not.toBe("");
    }
    expect(texts(sorKeyDoc(sor, kk.sor)).join("\n")).toContain("Жоғары деңгей дағдылары");
  });
});

describe("SOR form", () => {
  const base = { mode: "sor" as const, subject: "Литература", grade: "7", section: "Телеграмма", quarter: "", duration: "20", totalPoints: "12", taskCount: "", notes: "", language: "ru" as const };

  it("accepts a normal form", () => {
    expect(validateSorForm(base)).toEqual({});
  });

  it("checks the same rules as the server", () => {
    expect(validateSorForm({ ...base, mode: "soch" })).toEqual({ quarter: "required" });
    expect(validateSorForm({ ...base, subject: " ", duration: "5", totalPoints: "41" })).toEqual({ subject: "required", durationMinutes: "out_of_range", totalPoints: "out_of_range" });
    expect(validateSorForm({ ...base, totalPoints: "5", taskCount: "6" })).toEqual({ taskCount: "out_of_range" });
  });
});
