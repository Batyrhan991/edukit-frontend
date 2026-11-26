import { describe, expect, it } from "vitest";
import { chatErrorKey, inline, limitKey, parseAnswer, validateText } from "@/lib/chat";
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
      "conversationLimit", "memoryDuplicate", "memoryLimit", "notFound", "forbidden", "disabled", "offline", "unknown", "required", "too_long", "personal_data"];
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
