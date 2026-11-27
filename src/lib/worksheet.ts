import type { Dictionary } from "@/i18n/dictionaries";
import type { Schemas } from "./api/browser";
import { fmt } from "./format";
import { bullets, heading, paragraph, text, type DocNode } from "./ksp-doc";
import { answerTable, questionNodes, type QuizLabels } from "./quiz";

export type WorksheetDocument = Schemas["WorksheetDocument"];
export type WorksheetLabels = Dictionary["worksheet"];
/** Подписи документа: свои (заголовки разделов) и общие подписи заданий (из тестов). */
export type WorksheetDocLabels = { ws: WorksheetLabels; quiz: QuizLabels };

export type WorksheetForm = {
  subject: string;
  grade: string;
  topic: string;
  count: string;
  difficulty: "basic" | "medium" | "advanced";
  theory: boolean;
  notes: string;
  language: "kk" | "ru" | "en";
};

/** Проверка до отправки — те же правила, что на сервере (ADR-0050); окончательно решает сервер. */
export function validateWorksheetForm(form: WorksheetForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.subject.trim()) errors.subject = "required";
  if (!form.grade.trim()) errors.grade = "required";
  if (!form.topic.trim()) errors.topic = "required";
  const count = Number(form.count);
  if (!Number.isInteger(count) || count < 3 || count > 12) errors.taskCount = "out_of_range";
  return errors;
}

function header(ws: WorksheetDocument, l: QuizLabels): DocNode[] {
  return [
    paragraph(text(`${l.subjectLine}: `, true), text(ws.subject)),
    paragraph(text(`${l.gradeLine}: `, true), text(ws.grade)),
    paragraph(text(`${l.topicLine}: `, true), text(ws.topic)),
  ];
}

/** Лист для учеников: памятка, задания без ответов, строка самооценки. */
export function worksheetStudentDoc(ws: WorksheetDocument, l: WorksheetDocLabels, locale: string): DocNode {
  const content: DocNode[] = [heading(1, ws.title), ...header(ws, l.quiz), paragraph(text(l.quiz.studentLine))];
  if (ws.theory.trim()) {
    content.push(heading(2, l.ws.theoryTitle));
    for (const line of ws.theory.split("\n").filter((x) => x.trim())) content.push(paragraph(text(line)));
  }
  content.push(heading(2, l.ws.tasksTitle));
  for (const task of ws.tasks) content.push(...questionNodes(task, l.quiz, locale, l.ws.taskTitle));
  content.push(heading(2, l.ws.reflectionTitle), paragraph(text(ws.reflection)), paragraph(text(l.quiz.answerLine)));
  return { type: "doc", content };
}

/** Ключ учителя: ответы и баллы по заданиям, цели обучения, источники. */
export function worksheetKeyDoc(ws: WorksheetDocument, l: WorksheetDocLabels, locale: string): DocNode {
  const total = ws.tasks.reduce((sum, q) => sum + Number(q.points), 0);
  const content: DocNode[] = [heading(1, fmt(l.ws.keyDoc, { title: ws.title })), ...header(ws, l.quiz), paragraph(text(fmt(l.quiz.totalLine, { n: String(total) })))];
  if (ws.learningObjectives.length > 0) content.push(heading(2, l.quiz.learningObjectives), bullets(ws.learningObjectives.map((o) => `${o.code} ${o.text}`)));
  content.push(answerTable(ws.tasks, l.quiz, locale));
  if (ws.sources.length > 0) content.push(heading(2, l.quiz.sources), bullets(ws.sources.map((s) => s.title)));
  return { type: "doc", content };
}
