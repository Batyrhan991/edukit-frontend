import type { Dictionary } from "@/i18n/dictionaries";
import type { Schemas } from "./api/browser";
import { fmt } from "./format";
import { bullets, heading, paragraph, text, type DocNode } from "./ksp-doc";
import { answerTable, questionNodes, type QuizLabels } from "./quiz";

export type HomeworkDocument = Schemas["HomeworkDocument"];
export type HomeworkLabels = Dictionary["homework"];
/** Подписи документа: свои (уровни) и общие подписи заданий (из тестов). */
export type HomeworkDocLabels = { hw: HomeworkLabels; quiz: QuizLabels };

export type HomeworkForm = {
  subject: string;
  grade: string;
  topic: string;
  perLevel: string;
  notes: string;
  language: "kk" | "ru" | "en";
};

/** Проверка до отправки — те же правила, что на сервере (ADR-0051); окончательно решает сервер. */
export function validateHomeworkForm(form: HomeworkForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.subject.trim()) errors.subject = "required";
  if (!form.grade.trim()) errors.grade = "required";
  if (!form.topic.trim()) errors.topic = "required";
  const count = Number(form.perLevel);
  if (!Number.isInteger(count) || count < 1 || count > 4) errors.tasksPerLevel = "out_of_range";
  return errors;
}

/** Заголовок уровня: «Уровень A — базовый». */
export function levelTitle(level: string, l: HomeworkLabels): string {
  const name = (l.levelNames as Record<string, string>)[level] ?? "";
  return fmt(l.levelTitle, { level, name });
}

function header(hw: HomeworkDocument, l: QuizLabels): DocNode[] {
  return [
    paragraph(text(`${l.subjectLine}: `, true), text(hw.subject)),
    paragraph(text(`${l.gradeLine}: `, true), text(hw.grade)),
    paragraph(text(`${l.topicLine}: `, true), text(hw.topic)),
  ];
}

/** Листок для учеников: инструкция и три уровня заданий без ответов. */
export function homeworkStudentDoc(hw: HomeworkDocument, l: HomeworkDocLabels, locale: string): DocNode {
  const content: DocNode[] = [heading(1, hw.title), ...header(hw, l.quiz), paragraph(text(l.quiz.studentLine)), paragraph(text(hw.instructions, true))];
  for (const level of hw.levels) {
    content.push(heading(2, levelTitle(level.level, l.hw)), paragraph(text(level.description)));
    for (const task of level.tasks) content.push(...questionNodes(task, l.quiz, locale, l.hw.taskTitle));
  }
  return { type: "doc", content };
}

/** Ключ учителя: ответы и баллы по каждому уровню, цели обучения, источники. */
export function homeworkKeyDoc(hw: HomeworkDocument, l: HomeworkDocLabels, locale: string): DocNode {
  const content: DocNode[] = [heading(1, fmt(l.hw.keyDoc, { title: hw.title })), ...header(hw, l.quiz)];
  if (hw.learningObjectives.length > 0) content.push(heading(2, l.quiz.learningObjectives), bullets(hw.learningObjectives.map((o) => `${o.code} ${o.text}`)));
  for (const level of hw.levels) {
    const total = level.tasks.reduce((sum, q) => sum + Number(q.points), 0);
    content.push(heading(2, levelTitle(level.level, l.hw)), paragraph(text(fmt(l.quiz.totalLine, { n: String(total) }))), answerTable(level.tasks, l.quiz, locale));
  }
  if (hw.sources.length > 0) content.push(heading(2, l.quiz.sources), bullets(hw.sources.map((s) => s.title)));
  return { type: "doc", content };
}
