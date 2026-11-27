import { describe, expect, it } from "vitest";
import { chatErrorKey, fileSize, inline, limitKey, parseAnswer, safeLink, validateFile, validateText } from "@/lib/chat";
import en from "../../messages/en.json";
import kk from "../../messages/kk.json";
import ru from "../../messages/ru.json";

describe("parseAnswer", () => {
  it("splits paragraphs, bullet and numbered lists", () => {
    const blocks = parseAnswer("Начало урока.\nВторая строка.\n\n- первое\n- **второе**\n\n1. шаг\n2) шаг два\nИтог");
    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "bullets", "numbers", "paragraph"]);
    expect(blocks[0]).toMatchObject({ lines: [[{ text: "Начало урока.", bold: false }], [{ text: "Вторая строка.", bold: false }]] });
    expect(blocks[1]).toMatchObject({ items: [[{ text: "первое" }], [{ text: "второе", bold: true }]] });
    expect(blocks[2]).toMatchObject({ items: [[{ text: "шаг" }], [{ text: "шаг два" }]] });
  });

  it("keeps HTML as plain text", () => {
    const blocks = parseAnswer('<img src=x onerror="alert(1)"> текст');
    expect(blocks).toEqual([{ kind: "paragraph", lines: [[{ text: '<img src=x onerror="alert(1)"> текст', bold: false }]] }]);
  });

  it("ignores empty lines and unmatched stars", () => {
    expect(parseAnswer("\n\n")).toEqual([]);
    expect(inline("2 ** 3 = 8")).toEqual([{ text: "2 ** 3 = 8", bold: false }]);
    expect(inline("**а** и **б**").filter((p) => p.bold).map((p) => p.text)).toEqual(["а", "б"]);
  });
});

describe("chat errors", () => {
  it("maps server codes", () => {
    expect(chatErrorKey("chat.answer_pending")).toBe("pending");
    expect(chatErrorKey("credits.insufficient")).toBe("insufficient");
    expect(chatErrorKey("chat.memory_limit")).toBe("memoryLimit");
    expect(chatErrorKey("api.unreachable", 503)).toBe("offline");
    expect(chatErrorKey(undefined, 403)).toBe("forbidden");
    expect(chatErrorKey(undefined, 404)).toBe("disabled");
    expect(limitKey("chat.limit_reached", "message")).toBe("messageLimit");
    expect(limitKey("chat.limit_reached", "conversation")).toBe("conversationLimit");
    expect(limitKey("other", "message")).toBeNull();
  });

  it("has a message for every error key in all languages", () => {
    const keys = ["insufficient", "tooMany", "conflict", "provider", "invalid", "timeout", "interrupted", "busy", "budget", "pending", "messageLimit",
      "conversationLimit", "memoryDuplicate", "memoryLimit", "notFound", "forbidden", "disabled", "offline", "unknown", "required", "too_long", "personal_data",
      "fileTooLarge", "fileUnsupported", "fileNoText", "fileUnreadable", "fileInfected", "scannerDown", "fileLimit"];
    for (const dict of [ru, kk, en]) {
      for (const key of keys) expect((dict.chat.errors as Record<string, string>)[key], key).toBeTruthy();
    }
  });

  it("validates text length before sending", () => {
    expect(validateText("  ", 10)).toBe("required");
    expect(validateText("a".repeat(11), 10)).toBe("too_long");
    expect(validateText(" вопрос ", 10)).toBeNull();
  });
});

describe("chat files", () => {
  it("checks extension and size before upload", () => {
    expect(validateFile("План.PDF", 1000)).toBeNull();
    expect(validateFile("plan.docx", 1000)).toBeNull();
    expect(validateFile("notes.txt", 10)).toBeNull();
    expect(validateFile("photo.png", 1000)).toBe("fileUnsupported");
    expect(validateFile("plan.pdf.exe", 1000)).toBe("fileUnsupported");
    expect(validateFile("old.doc", 1000)).toBe("fileUnsupported");
    expect(validateFile("big.pdf", 50 * 1024 * 1024 + 1)).toBe("fileTooLarge");
    expect(validateFile("empty.txt", 0)).toBe("fileNoText");
  });

  it("maps file errors from the server and the proxy", () => {
    expect(chatErrorKey("files.infected")).toBe("fileInfected");
    expect(chatErrorKey("files.scanner_unavailable", 503)).toBe("scannerDown");
    expect(chatErrorKey("files.unsupported", 415)).toBe("fileUnsupported");
    expect(chatErrorKey("proxy.body_too_large", 413)).toBe("fileTooLarge");
    expect(chatErrorKey(undefined, 413)).toBe("fileTooLarge");
    expect(chatErrorKey("chat.attachment_limit")).toBe("fileLimit");
  });

  it("formats file sizes", () => {
    const units = { kb: "КБ", mb: "МБ" };
    expect(fileSize(300, "ru-RU", units)).toBe("1 КБ");
    expect(fileSize(20 * 1024, "ru-RU", units)).toBe("20 КБ");
    expect(fileSize(3.5 * 1024 * 1024, "ru-RU", units)).toBe("3,5 МБ");
  });
});

describe("web sources", () => {
  it("links only http and https addresses", () => {
    expect(safeLink("https://www.gov.kz/memleket/entities/edu")).toEqual({ href: "https://www.gov.kz/memleket/entities/edu", host: "gov.kz" });
    expect(safeLink("http://example.org/a")?.host).toBe("example.org");
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink("data:text/html,<b>x</b>")).toBeNull();
    expect(safeLink("/relative")).toBeNull();
    expect(safeLink(null)).toBeNull();
  });
});
