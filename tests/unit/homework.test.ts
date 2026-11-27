import { describe, expect, it } from "vitest";
import { homeworkKeyDoc, homeworkStudentDoc, levelTitle, validateHomeworkForm, type HomeworkDocument } from "@/lib/homework";
import type { DocNode } from "@/lib/ksp-doc";
import en from "../../messages/en.json";
import kk from "../../messages/kk.json";
import ru from "../../messages/ru.json";

const task = (number: number, type: string, answer: string) => ({
  number,
  type,
  text: type === "fill" ? "Автор — ___." : `Задание ${number}`,
  options: [],
  correct: [],
  answer,
  pairs: [],
  points: 2,
  explanation: "",
});

const hw: HomeworkDocument = {
  title: "Домашнее задание: Телеграмма",
  subject: "Русская литература",
  grade: "7",
  topic: "Телеграмма",
  instructions: "Выберите уровень.",
  levels: [
    { level: "A", description: "Вспомнить.", tasks: [task(1, "fill", "СЕКРЕТ-A")] },
    { level: "B", description: "Применить.", tasks: [task(1, "open", "СЕКРЕТ-B")] },
    { level: "C", description: "Создать.", tasks: [task(1, "extended", "СЕКРЕТ-C")] },
  ],
  learningObjectives: [],
  sources: [],
  warnings: [],
};
const labels = { hw: ru.homework, quiz: ru.quiz };

function texts(doc: DocNode): string[] {
  const out: string[] = [];
  const walk = (n: DocNode) => {
    if (n.type === "text" && typeof n.text === "string") out.push(n.text);
    for (const c of n.content ?? []) walk(c);
  };
  walk(doc);
  return out;
}

describe("homework", () => {
  it("validates the form", () => {
    const form = { subject: "Литература", grade: "7", topic: "Телеграмма", perLevel: "2", notes: "", language: "ru" as const };
    expect(validateHomeworkForm(form)).toEqual({});
    expect(validateHomeworkForm({ ...form, perLevel: "5" }).tasksPerLevel).toBe("out_of_range");
    expect(validateHomeworkForm({ ...form, perLevel: "0" }).tasksPerLevel).toBe("out_of_range");
  });

  it("names the levels in every language", () => {
    expect(levelTitle("C", ru.homework)).toBe("Уровень C — творческий");
    expect(levelTitle("A", kk.homework)).toBe("A деңгейі — базалық");
    expect(levelTitle("B", en.homework)).toBe("Level B — medium");
  });

  it("student sheet has three levels and no answers", () => {
    const all = texts(homeworkStudentDoc(hw, labels, "ru"));
    expect(all).toContain("Уровень A — базовый");
    expect(all).toContain("Уровень C — творческий");
    expect(all).toContain("Выберите уровень.");
    expect(all.join("\n")).not.toContain("СЕКРЕТ");
  });

  it("key has answers for every level", () => {
    const all = texts(homeworkKeyDoc(hw, labels, "ru")).join("\n");
    for (const secret of ["СЕКРЕТ-A", "СЕКРЕТ-B", "СЕКРЕТ-C"]) expect(all).toContain(secret);
    expect(all).toContain("Ключ: Домашнее задание: Телеграмма");
  });

  it("has the same homework keys in every language", () => {
    expect(Object.keys(kk.homework).sort()).toEqual(Object.keys(ru.homework).sort());
    expect(Object.keys(en.homework).sort()).toEqual(Object.keys(ru.homework).sort());
  });
});
