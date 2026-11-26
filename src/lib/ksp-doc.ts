import type { KspDocument } from "@/lib/api/browser";

/** Узел документа Tiptap (JSON). Сервер принимает только узлы и метки из ADR-0039. */
export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: { type: string }[];
};

export type KspDocLabels = {
  subject: string;
  grade: string;
  lessonTypeTitle: string;
  lessonObjectives: string;
  learningObjectives: string;
  passport: string;
  stage: string;
  minutes: string;
  teacherActivity: string;
  studentActivity: string;
  flow: string;
  differentiation: string;
  assessment: string;
  homework: string;
  resources: string;
  sources: string;
  minutesShort: string;
  kind: Record<string, string>;
};

/** Текстовый узел: пустой текст редактор не допускает — возвращаем пустой список. Пробелы внутри сохраняются. */
function text(value: string | null | undefined, bold = false): DocNode[] {
  const raw = value ?? "";
  if (!raw.trim()) return [];
  return [bold ? { type: "text", text: raw, marks: [{ type: "bold" }] } : { type: "text", text: raw }];
}

const paragraph = (...parts: DocNode[][]): DocNode => {
  const content = parts.flat();
  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
};

const heading = (level: number, value: string): DocNode => ({ type: "heading", attrs: { level }, content: text(value) });

const bullets = (items: readonly string[]): DocNode => ({
  type: "bulletList",
  content: items.filter((i) => i.trim()).map((i) => ({ type: "listItem", content: [paragraph(text(i))] })),
});

const cell = (type: "tableCell" | "tableHeader", value: string): DocNode => ({
  type,
  attrs: { colspan: 1, rowspan: 1, colwidth: null },
  content: [paragraph(text(value, type === "tableHeader"))],
});

/**
 * КСП → документ редактора по структуре образца владельца (ADR-0035): заголовок, шапка, цели, таблица «Паспорт урока»,
 * «Ход урока» по этапам с подписями «Учитель:», «Учащиеся:», «Задание:».
 */
export function kspToDoc(ksp: KspDocument, l: KspDocLabels): DocNode {
  const content: DocNode[] = [heading(1, ksp.topic)];
  content.push(paragraph(text(`${l.subject}: `, true), text(ksp.subject)));
  content.push(paragraph(text(`${l.grade}: `, true), text(ksp.grade)));
  content.push(paragraph(text(`${l.lessonTypeTitle}: `, true), text(ksp.lessonType)));

  if (ksp.lessonObjectives.length > 0) {
    content.push(heading(2, l.lessonObjectives), bullets(ksp.lessonObjectives));
  }

  if (ksp.learningObjectives.length > 0) {
    content.push(heading(2, l.learningObjectives), bullets(ksp.learningObjectives.map((o) => `${o.code} ${o.text}`)));
  }

  content.push(heading(2, l.passport), {
    type: "table",
    content: [
      { type: "tableRow", content: [l.stage, l.minutes, l.teacherActivity, l.studentActivity].map((h) => cell("tableHeader", h)) },
      ...ksp.passport.map((p) => ({
        type: "tableRow",
        content: [p.stage, l.minutesShort.replace("{n}", String(p.minutes)), p.teacherActivity, p.studentActivity].map((v) => cell("tableCell", v)),
      })),
    ],
  });

  content.push(heading(2, l.flow));
  for (const stage of ksp.flow) {
    content.push(heading(3, stage.stage));
    for (const block of stage.blocks) {
      const label = block.label ?? l.kind[block.kind] ?? block.kind;
      content.push(paragraph(text(`${label}: `, true), text(block.text)));
    }
  }

  const sections: [string, string | null | undefined][] = [
    [l.differentiation, ksp.differentiation],
    [l.assessment, ksp.assessment],
    [l.homework, ksp.homework],
  ];
  for (const [title, value] of sections) {
    if (value?.trim()) content.push(heading(2, title), paragraph(text(value)));
  }

  if (ksp.resources.length > 0) content.push(heading(2, l.resources), bullets(ksp.resources));
  if (ksp.sources.length > 0) content.push(heading(2, l.sources), bullets(ksp.sources.map((s) => s.title)));

  // Пустой список (все пункты пустые) редактор не примет — убираем.
  return { type: "doc", content: content.filter((n) => n.type !== "bulletList" || (n.content?.length ?? 0) > 0) };
}
