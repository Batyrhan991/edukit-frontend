import type { SorDocument } from "@/lib/api/browser";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/lib/format";
import { bullets, cell, heading, paragraph, text, type DocNode } from "@/lib/ksp-doc";

export type SorLabels = Dictionary["sor"];

const n = (value: number | string | null | undefined) => String(Number(value ?? 0));

/** Шапка работы: предмет, класс, раздел, четверть, время, максимальный балл. */
function header(sor: SorDocument, l: SorLabels): DocNode[] {
  const lines: DocNode[] = [
    paragraph(text(`${l.subjectLine}: `, true), text(sor.subject)),
    paragraph(text(`${l.gradeLine}: `, true), text(sor.grade)),
    paragraph(text(`${l.sectionLine}: `, true), text(sor.section)),
  ];
  if (sor.quarter !== null && sor.quarter !== undefined) lines.push(paragraph(text(fmt(l.quarterLine, { n: n(sor.quarter) }))));
  lines.push(paragraph(text(fmt(l.durationLine, { n: n(sor.durationMinutes) }))), paragraph(text(fmt(l.totalLine, { n: n(sor.totalPoints) }))));
  return lines;
}

/**
 * Ученический вариант: шапка, строка для имени, задания с баллами. Ответов, дескрипторов и ключа здесь нет —
 * этот документ можно распечатать и раздать (ТЗ FR-03: ключ отдельно от ученического представления).
 */
export function sorTasksDoc(sor: SorDocument, l: SorLabels): DocNode {
  const content: DocNode[] = [heading(1, sor.title), ...header(sor, l), paragraph(text(l.studentLine))];
  content.push(heading(2, l.tasks));
  for (const task of sor.tasks) {
    content.push(heading(3, `${fmt(l.taskTitle, { n: n(task.number) })} (${fmt(l.points, { n: n(task.points) })})`));
    for (const line of task.text.split("\n")) content.push(paragraph(text(line)));
  }
  return { type: "doc", content };
}

/**
 * Ключ учителя: цели обучения, критерии, уровни навыков, ответы и схема выставления баллов (критерий — задание —
 * дескриптор — балл), итоговый балл.
 */
export function sorKeyDoc(sor: SorDocument, l: SorLabels): DocNode {
  const content: DocNode[] = [heading(1, fmt(l.keyDoc, { title: sor.title })), ...header(sor, l)];
  if (sor.learningObjectives.length > 0) {
    content.push(heading(2, l.learningObjectives), bullets(sor.learningObjectives.map((o) => `${o.code} ${o.text}`)));
  }
  content.push(heading(2, l.criteria), bullets(sor.assessmentCriteria.map((c, i) => `${i + 1}. ${c}`)));

  content.push(heading(2, l.key));
  for (const task of sor.tasks) {
    const level = (l.levels as Record<string, string>)[task.thinkingLevel] ?? task.thinkingLevel;
    content.push(heading(3, `${fmt(l.taskTitle, { n: n(task.number) })} (${fmt(l.points, { n: n(task.points) })})`));
    content.push(paragraph(text(`${l.thinkingLevel}: `, true), text(level)));
    content.push(paragraph(text(`${l.answer}: `, true), text(task.answer)));
  }

  const criterion = (i: number | string) => sor.assessmentCriteria[Number(i) - 1] ?? "";
  content.push({
    type: "table",
    content: [
      { type: "tableRow", content: [l.criterionHeader, l.taskHeader, l.descriptor, l.pointsHeader].map((h) => cell("tableHeader", h)) },
      ...sor.tasks.flatMap((task) =>
        task.descriptors.map((d) => ({
          type: "tableRow",
          content: [criterion(task.criterion), n(task.number), d.text, n(d.points)].map((v) => cell("tableCell", v)),
        })),
      ),
    ],
  });
  content.push(paragraph(text(fmt(l.totalLine, { n: n(sor.totalPoints) }), true)));
  if (sor.sources.length > 0) content.push(heading(2, l.sources), bullets(sor.sources.map((s) => s.title)));
  return { type: "doc", content: content.filter((node) => node.type !== "bulletList" || (node.content?.length ?? 0) > 0) };
}
