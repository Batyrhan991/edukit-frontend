import type { Schemas } from "./api/browser";

export type ChatConversation = Schemas["ChatConversationResponse"];
export type ChatSummary = Schemas["ChatConversationSummary"];
export type ChatMessage = Schemas["ChatMessageResponse"];
export type MemoryItem = Schemas["AiMemoryResponse"];
export type Attachment = Schemas["ChatAttachmentResponse"];

export const MAX_QUESTION = 4000;
export const MAX_MEMORY = 300;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_FILES = 5;
export const FILE_ACCEPT = ".pdf,.docx,.txt";

/** Кусок строки ответа: обычный текст или **жирный**. */
export type Inline = { text: string; bold: boolean };

/** Блок ответа AI. Ответ — недоверенный текст: показываем только как текст, без HTML. */
export type AnswerBlock =
  | { kind: "paragraph"; lines: Inline[][] }
  | { kind: "bullets"; items: Inline[][] }
  | { kind: "numbers"; items: Inline[][] };

const bullet = /^\s*[-*•]\s+(.*)$/;
const number = /^\s*\d{1,3}[.)]\s+(.*)$/;

/** **жирный** → отдельные куски; непарные звёздочки остаются текстом. */
export function inline(line: string): Inline[] {
  const parts: Inline[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: line.slice(last, match.index), bold: false });
    parts.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last), bold: false });
  return parts.length > 0 ? parts : [{ text: "", bold: false }];
}

/** Абзацы разделяются пустой строкой; строки «- …» и «1. …» — списки. */
export function parseAnswer(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const current = blocks.at(-1);
    if (line.trim() === "") {
      if (current && current.kind === "paragraph") blocks.push({ kind: "paragraph", lines: [] });
      continue;
    }

    const b = bullet.exec(line);
    const n = b ? null : number.exec(line);
    if (b || n) {
      const kind = b ? "bullets" : "numbers";
      const item = inline((b ?? n)![1]);
      if (current && current.kind === kind) current.items.push(item);
      else blocks.push({ kind, items: [item] });
      continue;
    }

    if (current && current.kind === "paragraph") current.lines.push(inline(line));
    else blocks.push({ kind: "paragraph", lines: [inline(line)] });
  }
  return blocks.filter((block) => block.kind !== "paragraph" || block.lines.length > 0);
}

export type ChatErrorKey =
  | "insufficient"
  | "tooMany"
  | "conflict"
  | "provider"
  | "invalid"
  | "timeout"
  | "interrupted"
  | "busy"
  | "budget"
  | "pending"
  | "messageLimit"
  | "conversationLimit"
  | "memoryDuplicate"
  | "memoryLimit"
  | "notFound"
  | "fileTooLarge"
  | "fileUnsupported"
  | "fileNoText"
  | "fileUnreadable"
  | "fileInfected"
  | "scannerDown"
  | "fileLimit"
  | "forbidden"
  | "disabled"
  | "offline"
  | "unknown";

export function chatErrorKey(code: string | null | undefined, status?: number): ChatErrorKey {
  switch (code) {
    case "credits.insufficient":
      return "insufficient";
    case "ai.too_many_active":
      return "tooMany";
    case "ai.idempotency_conflict":
      return "conflict";
    case "ai.provider_unavailable":
      return "provider";
    case "ai.invalid_output":
      return "invalid";
    case "ai.timeout":
      return "timeout";
    case "ai.interrupted":
      return "interrupted";
    case "ai.busy":
      return "busy";
    case "ai.budget_exceeded":
      return "budget";
    case "chat.answer_pending":
      return "pending";
    case "chat.memory_duplicate":
      return "memoryDuplicate";
    case "chat.memory_limit":
      return "memoryLimit";
    case "chat.not_found":
    case "chat.memory_not_found":
      return "notFound";
    case "files.too_large":
    case "proxy.body_too_large":
      return "fileTooLarge";
    case "files.unsupported":
      return "fileUnsupported";
    case "files.no_text":
      return "fileNoText";
    case "files.unreadable":
      return "fileUnreadable";
    case "files.infected":
      return "fileInfected";
    case "files.scanner_unavailable":
      return "scannerDown";
    case "chat.attachment_limit":
      return "fileLimit";
    case "feature.disabled":
      return "disabled";
    case "api.unreachable":
      return "offline";
  }
  if (status === 413) return "fileTooLarge";
  if (status === 403) return "forbidden";
  if (status === 404) return "disabled";
  if (status === 429) return "tooMany";
  if (status === 502 || status === 503 || status === 504) return "offline";
  return "unknown";
}

/** Лимит бесед и лимит вопросов в беседе — один код сервера; различаем по месту запроса. */
export function limitKey(code: string | undefined, where: "conversation" | "message"): ChatErrorKey | null {
  if (code !== "chat.limit_reached") return null;
  return where === "conversation" ? "conversationLimit" : "messageLimit";
}

export function isPending(message: ChatMessage | undefined): boolean {
  return message?.status === "Pending" || message?.status === "Running";
}

/** Проверка поля до отправки — те же правила, что на сервере (длина; персональные данные проверяет сервер). */
export function validateText(text: string, max: number): "required" | "too_long" | null {
  const value = text.trim();
  if (value === "") return "required";
  if (value.length > max) return "too_long";
  return null;
}

/** Проверка файла до отправки: расширение и размер. Тип по содержимому и антивирус проверяет сервер. */
export function validateFile(name: string, size: number): ChatErrorKey | null {
  const extension = name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  if (![".pdf", ".docx", ".txt"].includes(extension)) return "fileUnsupported";
  if (size > MAX_FILE_BYTES) return "fileTooLarge";
  if (size === 0) return "fileNoText";
  return null;
}

/** Размер файла для подписи: «12 КБ», «3,4 МБ». */
export function fileSize(bytes: number, locale: string, units: { kb: string; mb: string }): string {
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return bytes < 1024 * 1024 ? `${format.format(Math.max(1, Math.round(bytes / 1024)))} ${units.kb}` : `${format.format(bytes / 1024 / 1024)} ${units.mb}`;
}

/** Ссылка источника показывается, только если это http/https (защита на случай неожиданных данных). */
export function safeLink(url: string | null | undefined): { href: string; host: string } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return { href: parsed.href, host: parsed.hostname.replace(/^www\./, "") };
  } catch {
    return null;
  }
}
