"use client";

import { ArrowLeft, BookOpen, FileText, LoaderCircle, MessageSquarePlus, Paperclip, Plus, Send, Sparkles, Trash2, TriangleAlert, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { intlLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { api, fieldErrors, readProblem, type Credits } from "@/lib/api/browser";
import {
  chatErrorKey,
  FILE_ACCEPT,
  fileSize,
  isPending,
  limitKey,
  MAX_FILES,
  MAX_MEMORY,
  MAX_QUESTION,
  parseAnswer,
  validateFile,
  validateText,
  type Attachment,
  type ChatConversation,
  type ChatErrorKey,
  type ChatMessage,
  type ChatSummary,
  type Inline,
  type MemoryItem,
} from "@/lib/chat";
import { fmt, formatDateTime } from "@/lib/format";

type T = Dictionary["chat"];
type View = { kind: "list" } | { kind: "conversation"; id: string } | { kind: "memory" };
type FieldError = keyof T["errors"];
const POLL_MS = 1500;
const inputClass =
  "w-full min-w-0 rounded-sm border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

function newKey(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

/**
 * AI-помощник учителя справа (ТЗ FR-03, ADR-0045). Панель не модальная: учитель может работать со страницей и
 * спрашивать одновременно. Права, кредиты и лимиты проверяет сервер; панель только показывает его ответы.
 */
export function ChatPanel({ t, locale }: { t: T; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ kind: "list" });
  const titleId = useId();
  const openerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Панель живёт в макете кабинета: при переходах между страницами учителя она остаётся открытой.
  const returnFocus = useRef(false);
  const toggle = (next: boolean) => {
    setOpen(next);
    returnFocus.current = !next;
  };

  // Фокус — в панель при открытии и обратно на кнопку при закрытии (после того как элемент появился на странице).
  useEffect(() => {
    if (open) panelRef.current?.focus();
    else if (returnFocus.current) openerRef.current?.focus();
    // На широком экране страница сдвигается влево и не прячется под панелью (globals.css, html.chat-open).
    document.documentElement.classList.toggle("chat-open", open);
    return () => document.documentElement.classList.remove("chat-open");
  }, [open]);

  return (
    <>
      {!open ? (
        <button
          ref={openerRef}
          type="button"
          onClick={() => toggle(true)}
          className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-sm bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          data-testid="chat-open"
        >
          <Sparkles aria-hidden className="size-4" />
          {t.open}
        </button>
      ) : null}
      {open ? (
        <aside
          ref={panelRef}
          tabIndex={-1}
          aria-labelledby={titleId}
          onKeyDown={(e) => {
            if (e.key === "Escape") toggle(false);
          }}
          className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border bg-background shadow-2xl outline-none sm:w-[28rem]"
          data-testid="chat-panel"
        >
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Sparkles aria-hidden className="size-5 text-primary" />
            <h2 id={titleId} className="flex-1 text-lg font-semibold">
              {t.title}
            </h2>
            <Button variant="ghost" size="icon" aria-label={t.close} onClick={() => toggle(false)}>
              <X aria-hidden />
            </Button>
          </header>
          {view.kind === "list" ? (
            <ConversationList t={t} locale={locale} onOpen={(id) => setView({ kind: "conversation", id })} onMemory={() => setView({ kind: "memory" })} />
          ) : view.kind === "conversation" ? (
            <Conversation key={view.id} t={t} locale={locale} id={view.id} onBack={() => setView({ kind: "list" })} />
          ) : (
            <Memory t={t} onBack={() => setView({ kind: "list" })} />
          )}
        </aside>
      ) : null}
    </>
  );
}

function ErrorText({ t, error }: { t: T; error: ChatErrorKey | FieldError | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      {(t.errors as Record<string, string>)[error] ?? t.errors.unknown}
    </p>
  );
}

function ConversationList({ t, locale, onOpen, onMemory }: { t: T; locale: Locale; onOpen: (id: string) => void; onMemory: () => void }) {
  const [items, setItems] = useState<ChatSummary[] | null>(null);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [error, setError] = useState<ChatErrorKey | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [list, balance] = await Promise.all([api("GET", "/chat/conversations"), api("GET", "/credits")]);
      if (!alive) return;
      if (list.ok) setItems((await list.json()) as ChatSummary[]);
      else {
        const problem = await readProblem(list);
        setError(chatErrorKey(problem.code, problem.status));
        setItems([]);
      }
      if (balance.ok) setCredits((await balance.json()) as Credits);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function create() {
    setCreating(true);
    setError(null);
    const response = await api("POST", "/chat/conversations", { language: locale });
    setCreating(false);
    if (response.ok) {
      onOpen(((await response.json()) as ChatConversation).id);
      return;
    }
    const problem = await readProblem(response);
    setError(limitKey(problem.code, "conversation") ?? chatErrorKey(problem.code, problem.status));
  }

  const price = credits?.prices.find((p) => p.tool === "chat")?.credits;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="space-y-2 text-sm">
        <p>{t.intro}</p>
        <p className="text-muted-foreground">{t.privacy}</p>
        {credits && price !== undefined ? (
          <p className="text-muted-foreground" data-testid="chat-price">
            {fmt(t.price, { price: String(price), balance: String(credits.balance) })}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={create} disabled={creating || error === "disabled" || error === "forbidden"}>
          {creating ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <MessageSquarePlus aria-hidden />}
          {t.newConversation}
        </Button>
        <Button variant="secondary" onClick={onMemory} disabled={error === "disabled" || error === "forbidden"}>
          <BookOpen aria-hidden />
          {t.memory}
        </Button>
      </div>
      <ErrorText t={t} error={error} />
      <section aria-label={t.conversations} className="space-y-2">
        <h3 className="text-sm font-semibold">{t.conversations}</h3>
        {items === null ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t.loading}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          <ul className="divide-y divide-border border border-border bg-card" data-testid="chat-conversations">
            {items.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onOpen(c.id)} className="block w-full px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                  <span className="block truncate text-sm font-medium">{c.title || t.untitled}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[c.subject, c.grade].filter(Boolean).join(" · ")}
                    {c.subject || c.grade ? " · " : ""}
                    {formatDateTime(c.updatedAt, intlLocale[locale])}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Conversation({ t, locale, id, onBack }: { t: T; locale: Locale; id: string; onBack: () => void }) {
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [error, setError] = useState<ChatErrorKey | FieldError | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef(newKey());
  const endRef = useRef<HTMLDivElement>(null);
  const questionId = useId();
  const last = conversation?.messages.at(-1);
  const waiting = isPending(last);

  const load = useCallback(async () => {
    const response = await api("GET", `/chat/conversations/${id}`);
    if (response.ok) {
      setConversation((await response.json()) as ChatConversation);
      return true;
    }
    const problem = await readProblem(response);
    setError(chatErrorKey(problem.code, problem.status));
    return false;
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => void load(), POLL_MS);
    return () => clearTimeout(timer);
  }, [waiting, conversation, load]);

  const count = conversation?.messages.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count, last?.status]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const local = validateText(text, MAX_QUESTION);
    setError(local);
    if (local || sending || waiting) return;
    setSending(true);
    const response = await api("POST", `/chat/conversations/${id}/messages`, { text: text.trim() }, { "Idempotency-Key": keyRef.current });
    setSending(false);
    if (response.ok) {
      setText("");
      keyRef.current = newKey();
      await load();
      return;
    }
    const problem = await readProblem(response);
    // Нет связи — тот же ключ при повторе: сервер не спишет кредит дважды. Иначе — новая попытка.
    if (problem.code !== "api.unreachable" && problem.status !== 503) keyRef.current = newKey();
    const field = fieldErrors(problem).text as FieldError | undefined;
    setError(field ?? limitKey(problem.code, "message") ?? chatErrorKey(problem.code, problem.status));
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  async function cancel(message: ChatMessage) {
    const response = await api("POST", `/chat/messages/${message.id}/cancel`);
    if (!response.ok) setError(chatErrorKey((await readProblem(response)).code, response.status));
    await load();
  }

  async function remove() {
    const response = await api("DELETE", `/chat/conversations/${id}`);
    if (response.ok || response.status === 404) onBack();
    else setError(chatErrorKey((await readProblem(response)).code, response.status));
  }

  /** Файл отправляется сразу; сервер проверяет тип, антивирусом и извлекает текст (ADR-0046). */
  async function upload(file: File) {
    const local = validateFile(file.name, file.size);
    setError(local);
    if (local) return;
    setUploading(file.name);
    const form = new FormData();
    form.append("file", file, file.name);
    let response: Response;
    try {
      response = await fetch(`/api/v1/chat/conversations/${id}/attachments`, {
        method: "POST",
        headers: { accept: "application/json", "X-EduKit-Csrf": "1" },
        body: form,
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      response = Response.json({ code: "api.unreachable" }, { status: 503 });
    }
    setUploading(null);
    if (response.ok) {
      await load();
      return;
    }
    const problem = await readProblem(response);
    setError((fieldErrors(problem).file as FieldError | undefined) ?? chatErrorKey(problem.code, problem.status));
  }

  async function removeFile(file: Attachment) {
    const response = await api("DELETE", `/chat/attachments/${file.id}`);
    if (!response.ok && response.status !== 404) setError(chatErrorKey((await readProblem(response)).code, response.status));
    await load();
  }

  async function remember(value: string) {
    const response = await api("POST", "/chat/memory", { text: value });
    if (!response.ok) {
      const problem = await readProblem(response);
      setError((fieldErrors(problem).text as FieldError | undefined) ?? chatErrorKey(problem.code, problem.status));
    }
    await load();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden />
          {t.back}
        </Button>
        <span className="flex-1" />
        {confirmDelete ? (
          <span className="flex items-center gap-1 text-sm">
            <span>{t.deleteConfirm}</span>
            <Button variant="destructive" size="sm" onClick={remove}>
              {t.deleteYes}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              {t.deleteNo}
            </Button>
          </span>
        ) : (
          <Button variant="ghost" size="icon" aria-label={t.delete} onClick={() => setConfirmDelete(true)} disabled={!conversation}>
            <Trash2 aria-hidden />
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite" data-testid="chat-messages">
        {conversation ? <Context t={t} conversation={conversation} onSaved={setConversation} /> : null}
        {conversation === null && !error ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t.loading}
          </p>
        ) : null}
        {conversation?.messages.map((m) => (
          <MessageView key={m.id} t={t} message={m} onCancel={() => cancel(m)} onRemember={remember} />
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} noValidate className="space-y-2 border-t border-border p-4">
        <ErrorText t={t} error={error} />
        {conversation && (conversation.attachments.length > 0 || uploading) ? (
          <section aria-label={t.files}>
            <ul className="flex flex-wrap gap-1.5" data-testid="chat-files">
              {conversation.attachments.map((file) => (
                <li key={file.id} className="flex max-w-full items-center gap-1 border border-border bg-card py-0.5 pr-0.5 pl-2 text-xs">
                  <FileText aria-hidden className="size-3.5 shrink-0 text-primary" />
                  <span className="truncate" title={file.fileName}>
                    {file.fileName}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {fileSize(Number(file.sizeBytes), intlLocale[locale], t)}
                    {file.truncated ? ` · ${t.fileTruncated}` : ""}
                  </span>
                  <Button variant="ghost" size="icon-xs" aria-label={fmt(t.fileDelete, { name: file.fileName })} onClick={() => removeFile(file)}>
                    <X aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
            {uploading ? (
              <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground" role="status">
                <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
                {fmt(t.uploading, { name: uploading })}
              </p>
            ) : null}
          </section>
        ) : null}
        <label htmlFor={questionId} className="sr-only">
          {t.question}
        </label>
        <textarea
          id={questionId}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            keyRef.current = newKey(); // другой текст — другая попытка
          }}
          onKeyDown={onKeyDown}
          rows={3}
          maxLength={MAX_QUESTION + 100}
          placeholder={t.placeholder}
          aria-invalid={error === "required" || error === "too_long" || error === "personal_data" ? true : undefined}
          className={`${inputClass} resize-none`}
          disabled={!conversation}
          data-testid="chat-input"
        />
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={FILE_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="chat-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // тот же файл можно выбрать снова
              if (file) void upload(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t.attach}
            title={t.attachHint}
            disabled={!conversation || uploading !== null || (conversation?.attachments.length ?? 0) >= MAX_FILES}
            onClick={() => fileRef.current?.click()}
            data-testid="chat-attach"
          >
            <Paperclip aria-hidden />
          </Button>
          <p className="flex-1 text-xs text-muted-foreground">{t.sendHint}</p>
          <Button type="submit" disabled={!conversation || sending || waiting} data-testid="chat-send">
            {sending ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Send aria-hidden />}
            {t.send}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Предмет и класс беседы — для поиска по учебной программе. */
function Context({ t, conversation, onSaved }: { t: T; conversation: ChatConversation; onSaved: (c: ChatConversation) => void }) {
  const [subject, setSubject] = useState(conversation.subject ?? "");
  const [grade, setGrade] = useState(conversation.grade ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<FieldError | ChatErrorKey | null>(null);
  const subjectId = useId();
  const gradeId = useId();
  const changed = subject.trim() !== (conversation.subject ?? "") || grade.trim() !== (conversation.grade ?? "");

  async function save(event: FormEvent) {
    event.preventDefault();
    setState("saving");
    setError(null);
    const response = await api("PUT", `/chat/conversations/${conversation.id}`, { title: null, subject: subject.trim() || null, grade: grade.trim() || null });
    if (response.ok) {
      onSaved((await response.json()) as ChatConversation);
      setState("saved");
      return;
    }
    const problem = await readProblem(response);
    const fields = fieldErrors(problem);
    setError(((fields.subject ?? fields.grade) as FieldError | undefined) ?? chatErrorKey(problem.code, problem.status));
    setState("idle");
  }

  return (
    <form onSubmit={save} className="space-y-2 border border-border bg-card p-3" noValidate>
      <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2">
        <div className="space-y-1">
          <label htmlFor={subjectId} className="text-xs font-medium">
            {t.subject}
          </label>
          <input id={subjectId} className={inputClass} value={subject} maxLength={200} onChange={(e) => { setSubject(e.target.value); setState("idle"); }} />
        </div>
        <div className="space-y-1">
          <label htmlFor={gradeId} className="text-xs font-medium">
            {t.grade}
          </label>
          <input id={gradeId} className={inputClass} value={grade} maxLength={40} onChange={(e) => { setGrade(e.target.value); setState("idle"); }} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs text-muted-foreground">{t.contextHint}</p>
        {state === "saved" && !changed ? <span className="text-xs text-muted-foreground" role="status">{t.contextSaved}</span> : null}
        <Button type="submit" size="sm" variant="secondary" disabled={!changed || state === "saving"}>
          {t.saveContext}
        </Button>
      </div>
      <ErrorText t={t} error={error} />
    </form>
  );
}

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) => (p.bold ? <strong key={i}>{p.text}</strong> : <Fragment key={i}>{p.text}</Fragment>))}
    </>
  );
}

/** Ответ показывается как текст (React экранирует его): HTML из ответа модели никогда не выполняется. */
function AnswerText({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {parseAnswer(text).map((block, i) =>
        block.kind === "paragraph" ? (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                <InlineText parts={line} />
              </Fragment>
            ))}
          </p>
        ) : block.kind === "bullets" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>
                <InlineText parts={item} />
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="list-decimal space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>
                <InlineText parts={item} />
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}

function MessageView({ t, message, onCancel, onRemember }: { t: T; message: ChatMessage; onCancel: () => void; onRemember: (text: string) => void }) {
  const answer = message.answer;
  return (
    <article className="space-y-2" data-testid="chat-message" data-status={message.status}>
      <p className="ml-8 border border-primary/30 bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap">{message.text}</p>
      {isPending(message) ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          <span className="flex-1">{t.thinking}</span>
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t.cancel}
          </Button>
        </div>
      ) : message.status === "Cancelled" ? (
        <p className="text-sm text-muted-foreground">{t.cancelled}</p>
      ) : message.status === "Failed" ? (
        <p className="text-sm text-destructive">{(t.errors as Record<string, string>)[chatErrorKey(message.errorCode)] ?? t.failed}</p>
      ) : answer ? (
        <div className="mr-4 space-y-3 border border-border bg-card px-3 py-2" data-testid="chat-answer">
          {message.mock ? <p className="text-xs font-medium text-muted-foreground">{t.sample}</p> : null}
          <AnswerText text={answer.text} />
          {answer.warnings.length > 0 ? (
            <div className="border-l-2 border-amber-500 pl-2 text-xs">
              <p className="font-medium">{t.warning}</p>
              {answer.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          ) : null}
          {answer.sources.length > 0 ? (
            <div className="text-xs text-muted-foreground">
              <p className="font-medium">{t.sources}</p>
              <ul className="list-disc pl-4">
                {answer.sources.map((s) => (
                  <li key={s.id}>{s.title}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {answer.suggestedMemory ? (
            <Button variant="secondary" size="sm" className="h-auto whitespace-normal py-1 text-left" onClick={() => onRemember(answer.suggestedMemory!)}>
              <Plus aria-hidden />
              {fmt(t.remember, { text: answer.suggestedMemory })}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function Memory({ t, onBack }: { t: T; onBack: () => void }) {
  const [items, setItems] = useState<MemoryItem[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<ChatErrorKey | FieldError | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();

  const load = useCallback(async () => {
    const response = await api("GET", "/chat/memory");
    if (response.ok) setItems((await response.json()) as MemoryItem[]);
    else {
      setItems([]);
      setError(chatErrorKey((await readProblem(response)).code, response.status));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function add(event: FormEvent) {
    event.preventDefault();
    const local = validateText(text, MAX_MEMORY);
    setError(local);
    if (local) return;
    setBusy(true);
    const response = await api("POST", "/chat/memory", { text: text.trim() });
    setBusy(false);
    if (response.ok) {
      setText("");
      await load();
      return;
    }
    const problem = await readProblem(response);
    setError((fieldErrors(problem).text as FieldError | undefined) ?? chatErrorKey(problem.code, problem.status));
  }

  async function remove(item: MemoryItem) {
    const response = await api("DELETE", `/chat/memory/${item.id}`);
    if (!response.ok && response.status !== 404) setError(chatErrorKey((await readProblem(response)).code, response.status));
    await load();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden />
          {t.back}
        </Button>
      </div>
      <h3 className="text-base font-semibold">{t.memory}</h3>
      <p className="text-sm">{t.memoryIntro}</p>
      <p className="text-sm text-muted-foreground">{t.privacy}</p>
      <form onSubmit={add} noValidate className="space-y-2">
        <label htmlFor={inputId} className="sr-only">
          {t.memory}
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            className={inputClass}
            value={text}
            maxLength={MAX_MEMORY + 50}
            placeholder={t.memoryPlaceholder}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={error === "required" || error === "too_long" || error === "personal_data" ? true : undefined}
            data-testid="memory-input"
          />
          <Button type="submit" disabled={busy}>
            {t.memoryAdd}
          </Button>
        </div>
        <ErrorText t={t} error={error} />
      </form>
      {items === null ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t.loading}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.memoryEmpty}</p>
      ) : (
        <ul className="divide-y divide-border border border-border bg-card" data-testid="memory-items">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 px-3 py-2 text-sm">
              <span className="flex-1">{item.text}</span>
              <Button variant="ghost" size="icon-sm" aria-label={t.memoryDelete} onClick={() => remove(item)}>
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
