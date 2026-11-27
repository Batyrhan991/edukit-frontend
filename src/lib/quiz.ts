import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import type { Schemas } from "./api/browser";
import { fmt } from "./format";
import { bullets, cell, heading, paragraph, text, type DocNode } from "./ksp-doc";

export type QuizDocument = Schemas["QuizDocument"];
export type QuizQuestion = Schemas["QuizQuestion"];
export type QuizLabels = Dictionary["quiz"];

export const QUIZ_TYPES = ["single", "multiple", "true_false", "fill", "matching", "open", "extended"] as const;
export type QuizType = (typeof QUIZ_TYPES)[number];
export const DIFFICULTIES = ["basic", "medium", "advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type QuizForm = {
  subject: string;
  grade: string;
  topic: string;
  count: string;
  types: QuizType[];
  difficulty: Difficulty;
  notes: string;
  language: Locale;
};

/** Проверка до отправки — те же правила, что на сервере (ADR-0049); окончательно решает сервер. */
export function validateQuizForm(form: QuizForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.subject.trim()) errors.subject = "required";
  if (!form.grade.trim()) errors.grade = "required";
  if (!form.topic.trim()) errors.topic = "required";
  const count = Number(form.count);
  if (!Number.isInteger(count) || count < 3 || count > 30) errors.questionCount = "out_of_range";
  if (form.types.length === 0) errors.types = "invalid";
  else if (Number.isInteger(count) && form.types.length > count) errors.types = "too_many";
  return errors;
}

/**
 * Порядок правой колонки соответствия в ученическом варианте: перемешан, но одинаков при каждом показе (зависит от номера
 * вопроса) и никогда не совпадает с ключом, если пар больше одной.
 */
export function shuffledRight(question: Pick<QuizQuestion, "number" | "pairs">): string[] {
  const right = question.pairs.map((p) => p.right);
  if (right.length < 2) return right;
  const shift = (Number(question.number) % (right.length - 1)) + 1; // 1…n-1: ни один элемент не остаётся на месте
  return right.map((_, i) => right[(i + shift) % right.length]);
}

/** Буква варианта: А, Б, В… (а для английского — A, B, C…). */
export function optionLetter(index: number, locale: string): string {
  const letters = locale === "en" ? "ABCDEFGH" : "АБВГДЕЖЗ";
  return letters[index] ?? String(index + 1);
}

const n = (value: number | string) => String(Number(value));

/** Правильный ответ для ключа одной строкой. */
export function answerText(q: QuizQuestion, l: QuizLabels, locale: string): string {
  switch (q.type) {
    case "single":
    case "multiple":
      return q.correct.map((c) => `${optionLetter(Number(c), locale)}) ${q.options[Number(c)] ?? ""}`).join("; ");
    case "true_false":
      return q.answer.trim() === "true" ? l.trueLabel : l.falseLabel;
    case "matching": {
      const right = shuffledRight(q);
      return q.pairs.map((p, i) => `${i + 1} — ${optionLetter(right.indexOf(p.right), locale)}`).join(", ");
    }
    default:
      return q.answer;
  }
}

function header(test: QuizDocument, l: QuizLabels): DocNode[] {
  return [
    paragraph(text(`${l.subjectLine}: `, true), text(test.subject)),
    paragraph(text(`${l.gradeLine}: `, true), text(test.grade)),
    paragraph(text(`${l.topicLine}: `, true), text(test.topic)),
  ];
}

/** Ученический вариант: вопросы, варианты, пропуски и колонки соответствия — без ответов и пояснений. */
export function quizStudentDoc(test: QuizDocument, l: QuizLabels, locale: string): DocNode {
  const content: DocNode[] = [heading(1, test.title), ...header(test, l), paragraph(text(l.studentLine))];
  for (const q of test.questions) {
    content.push(heading(3, `${fmt(l.questionTitle, { n: n(q.number) })} (${fmt(l.points, { n: n(q.points) })})`));
    content.push(paragraph(text(q.text)));
    if (q.type === "single" || q.type === "multiple") {
      content.push(paragraph(text(q.type === "single" ? l.chooseOne : l.chooseMany, true)));
      content.push(bullets(q.options.map((o, i) => `${optionLetter(i, locale)}) ${o}`)));
    } else if (q.type === "true_false") {
      content.push(paragraph(text(`${l.trueLabel} / ${l.falseLabel}`)));
    } else if (q.type === "matching") {
      const right = shuffledRight(q);
      content.push({
        type: "table",
        content: q.pairs.map((p, i) => ({
          type: "tableRow",
          content: [cell("tableCell", `${i + 1}. ${p.left}`), cell("tableCell", `${optionLetter(i, locale)}) ${right[i]}`)],
        })),
      });
    } else if (q.type === "open" || q.type === "extended") {
      content.push(paragraph(text(l.answerLine)));
    }
  }
  return { type: "doc", content };
}

/** Ключ учителя: правильные ответы, критерии и баллы, цели обучения. */
export function quizKeyDoc(test: QuizDocument, l: QuizLabels, locale: string): DocNode {
  const total = test.questions.reduce((sum, q) => sum + Number(q.points), 0);
  const content: DocNode[] = [heading(1, fmt(l.keyDoc, { title: test.title })), ...header(test, l), paragraph(text(fmt(l.totalLine, { n: String(total) })))];
  if (test.learningObjectives.length > 0) content.push(heading(2, l.learningObjectives), bullets(test.learningObjectives.map((o) => `${o.code} ${o.text}`)));
  content.push({
    type: "table",
    content: [
      { type: "tableRow", content: [l.colNumber, l.colType, l.colAnswer, l.colPoints].map((h) => cell("tableHeader", h)) },
      ...test.questions.map((q) => ({
        type: "tableRow",
        content: [
          n(q.number),
          (l.types as Record<string, string>)[q.type] ?? q.type,
          [answerText(q, l, locale), q.explanation].filter(Boolean).join(" — "),
          n(q.points),
        ].map((v) => cell("tableCell", v)),
      })),
    ],
  });
  if (test.sources.length > 0) content.push(heading(2, l.sources), bullets(test.sources.map((s) => s.title)));
  return { type: "doc", content };
}
