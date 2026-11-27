import { describe, expect, it } from "vitest";
import type { DocNode } from "@/lib/ksp-doc";
import { answerText, optionLetter, quizKeyDoc, quizStudentDoc, shuffledRight, validateQuizForm, type QuizDocument } from "@/lib/quiz";
import en from "../../messages/en.json";
import kk from "../../messages/kk.json";
import ru from "../../messages/ru.json";

const test: QuizDocument = {
  title: "Тест: Телеграмма",
  subject: "Русская литература",
  grade: "7",
  topic: "Телеграмма",
  questions: [
    { number: 1, type: "single", text: "Кто автор?", options: ["Чехов", "Паустовский", "Толстой"], correct: [1], answer: "", pairs: [], points: 1, explanation: "СЕКРЕТ-1" },
    { number: 2, type: "multiple", text: "Герои?", options: ["Настя", "Катерина Петровна", "Тихон", "Онегин"], correct: [0, 1, 2], answer: "", pairs: [], points: 2, explanation: "" },
    { number: 3, type: "true_false", text: "Настя приехала вовремя.", options: [], correct: [], answer: "false", pairs: [], points: 1, explanation: "" },
    { number: 4, type: "fill", text: "Рассказ называется «___».", options: [], correct: [], answer: "СЕКРЕТ-ПРОПУСК", pairs: [], points: 1, explanation: "" },
    {
      number: 5, type: "matching", text: "Соотнесите.", options: [], correct: [], answer: "",
      pairs: [{ left: "Настя", right: "дочь" }, { left: "Катерина Петровна", right: "мать" }, { left: "Тихон", right: "сторож" }], points: 2, explanation: "",
    },
    { number: 6, type: "open", text: "О чём рассказ?", options: [], correct: [], answer: "СЕКРЕТ-ОТКРЫТЫЙ", pairs: [], points: 2, explanation: "" },
  ],
  learningObjectives: [{ code: "7.1.1.1", text: "понимать" }],
  sources: [],
  warnings: [],
};

function texts(doc: DocNode): string[] {
  const out: string[] = [];
  const walk = (n: DocNode) => {
    if (n.type === "text" && typeof n.text === "string") out.push(n.text);
    for (const c of n.content ?? []) walk(c);
  };
  walk(doc);
  return out;
}

describe("quiz", () => {
  it("validates the form like the server", () => {
    const form = { subject: "Литература", grade: "7", topic: "Телеграмма", count: "5", types: ["single" as const], difficulty: "medium" as const, notes: "", language: "ru" as const };
    expect(validateQuizForm(form)).toEqual({});
    expect(validateQuizForm({ ...form, count: "2" }).questionCount).toBe("out_of_range");
    expect(validateQuizForm({ ...form, types: [] }).types).toBe("invalid");
    expect(validateQuizForm({ ...form, count: "3", types: ["single", "multiple", "fill", "open"] }).types).toBe("too_many");
  });

  it("shuffles the matching column so no answer stays in place", () => {
    for (const number of [1, 2, 3, 4, 5, 6, 7]) {
      const q = { number, pairs: test.questions[4].pairs };
      const right = shuffledRight(q);
      expect([...right].sort()).toEqual(q.pairs.map((p) => p.right).sort());
      right.forEach((r, i) => expect(r).not.toBe(q.pairs[i].right));
      expect(shuffledRight(q)).toEqual(right); // одинаково при каждом показе
    }
  });

  it("builds the student version without any answers", () => {
    const all = texts(quizStudentDoc(test, ru.quiz, "ru")).join("\n");
    expect(all).toContain("Б) Паустовский");
    expect(all).toContain("Выберите все верные ответы:");
    expect(all).not.toContain("СЕКРЕТ");
    expect(all).toContain("Ф. И.");
  });

  it("builds the key with correct answers", () => {
    const all = texts(quizKeyDoc(test, ru.quiz, "ru")).join("\n");
    expect(all).toContain("Б) Паустовский — СЕКРЕТ-1");
    expect(all).toContain("Неверно");
    expect(all).toContain("СЕКРЕТ-ПРОПУСК");
    expect(all).toContain("Всего баллов: 9");
    expect(answerText(test.questions[1], ru.quiz, "ru")).toBe("А) Настя; Б) Катерина Петровна; В) Тихон");
    // В ключе соответствия буквы — из перемешанной колонки ученического варианта.
    const right = shuffledRight(test.questions[4]);
    expect(answerText(test.questions[4], ru.quiz, "ru")).toBe(test.questions[4].pairs.map((p, i) => `${i + 1} — ${optionLetter(right.indexOf(p.right), "ru")}`).join(", "));
    expect(optionLetter(1, "en")).toBe("B");
  });

  it("has the same quiz keys in every language", () => {
    for (const dict of [kk, en]) {
      expect(Object.keys(dict.quiz).sort()).toEqual(Object.keys(ru.quiz).sort());
      expect(Object.keys(dict.quiz.types).sort()).toEqual(Object.keys(ru.quiz.types).sort());
      expect(Object.keys(dict.quiz.errors).sort()).toEqual(Object.keys(ru.quiz.errors).sort());
    }
  });
});
