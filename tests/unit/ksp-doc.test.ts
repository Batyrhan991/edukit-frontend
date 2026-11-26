import { describe, expect, it } from "vitest";
import type { KspDocument } from "@/lib/api/browser";
import { kspToDoc, type DocNode } from "@/lib/ksp-doc";
import kk from "../../messages/kk.json";
import ru from "../../messages/ru.json";

// Узлы и метки, которые принимает сервер (ADR-0039, TiptapContentValidator).
const allowedNodes = new Set(["doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem", "blockquote", "hardBreak", "horizontalRule", "table", "tableRow", "tableHeader", "tableCell"]);
const allowedMarks = new Set(["bold", "italic", "underline", "strike"]);

const ksp: KspDocument = {
  topic: "Образы-персонажи в рассказе «Телеграмма»",
  subject: "Русская литература",
  grade: "7",
  lessonType: "Изучение нового материала",
  lessonObjectives: ["Раскрыть систему образов", "  "],
  learningObjectives: [{ code: "7.1.1.1", text: "понимать термины" }],
  passport: [
    { stage: "1. Орг. момент", minutes: 3, teacherActivity: "Приветствие", studentActivity: "Настрой" },
    { stage: "2. Изучение", minutes: 42, teacherActivity: "Беседа", studentActivity: "Ответы" },
  ],
  flow: [{ stage: "1. Орг. момент", blocks: [{ kind: "teacher", label: null, text: "Здравствуйте!" }, { kind: "task", label: "Задание 1", text: "Выпишите детали" }] }],
  differentiation: null,
  assessment: "  ",
  homework: "Письмо Катерине Петровне",
  resources: ["Учебник"],
  sources: [],
  warnings: ["Проверьте соответствие программе"],
};

function walk(node: DocNode, visit: (n: DocNode) => void) {
  visit(node);
  node.content?.forEach((c) => walk(c, visit));
}

describe("kspToDoc", () => {
  it("uses only nodes and marks the server accepts, never empty text", () => {
    const doc = kspToDoc(ksp, ru.ksp);
    expect(doc.type).toBe("doc");
    walk(doc, (n) => {
      expect(allowedNodes.has(n.type)).toBe(true);
      if (n.type === "text") expect(n.text?.trim().length).toBeGreaterThan(0);
      n.marks?.forEach((m) => expect(allowedMarks.has(m.type)).toBe(true));
    });
  });

  it("builds the passport table with a header row and one row per stage", () => {
    const table = kspToDoc(ksp, ru.ksp).content!.find((n) => n.type === "table")!;
    expect(table.content).toHaveLength(3);
    expect(table.content![0].content![0].type).toBe("tableHeader");
    expect(JSON.stringify(table)).toContain("42 мин");
  });

  it("labels blocks in the plan's language and skips empty sections", () => {
    const json = JSON.stringify(kspToDoc(ksp, kk.ksp));
    expect(json).toContain("Мұғалім: ");
    expect(json).toContain("Задание 1: ");
    expect(json).toContain("Сабақ паспорты");
    expect(json).not.toContain(kk.ksp.assessment);
    expect(json).not.toContain(kk.ksp.differentiation);
    expect(json).not.toContain("Проверьте соответствие"); // предупреждения — не часть документа
  });
});
