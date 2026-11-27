import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/lib/format";
import { bullets, cell, heading, paragraph, text, type DocNode } from "@/lib/ksp-doc";
import { byQuarter, lessonDate, type KtpPlan } from "@/lib/ktp";

export type KtpLabels = Dictionary["ktp"];

/** Период для подписи: «1 четверть» или «Весь учебный год». */
export function periodLabel(period: string, l: KtpLabels): string {
  return period === "year" ? l.periodYear : fmt(l.periodQuarter, { n: period.slice(1) });
}

/**
 * КТП для редактора: шапка (предмет, класс, учебный год, период, всего часов) и по таблице на четверть
 * (№ — дата — раздел — тема — цели — часы — примечание). Подписи — на языке плана.
 */
export function ktpDoc(plan: KtpPlan, l: KtpLabels): DocNode {
  const hours = plan.rows.reduce((sum, r) => sum + Number(r.hours), 0);
  const content: DocNode[] = [
    heading(1, plan.title),
    paragraph(text(`${l.subjectLine}: `, true), text(plan.subject)),
    paragraph(text(`${l.gradeLine}: `, true), text(plan.grade)),
    paragraph(text(`${l.yearLine}: `, true), text(plan.academicYear)),
    paragraph(text(`${l.periodLine}: `, true), text(periodLabel(plan.period, l))),
    paragraph(text(fmt(l.hoursLine, { n: String(hours) }))),
  ];

  const headers = [l.colNumber, l.colDate, l.colSection, l.colTopic, l.colObjectives, l.colHours, l.colNotes];
  for (const group of byQuarter(plan.rows)) {
    content.push(heading(2, fmt(l.quarterHeading, { n: String(group.quarter) })));
    content.push({
      type: "table",
      content: [
        { type: "tableRow", content: headers.map((h) => cell("tableHeader", h)) },
        ...group.rows.map((r) => ({
          type: "tableRow",
          content: [
            String(Number(r.number)),
            lessonDate(r.date),
            r.section,
            r.topic,
            r.objectives.join(", "),
            String(Number(r.hours)),
            r.notes ?? "",
          ].map((v) => cell("tableCell", v)),
        })),
      ],
    });
  }

  if (plan.sources.length > 0) content.push(heading(2, l.sources), bullets(plan.sources.map((s) => s.title)));
  return { type: "doc", content };
}
