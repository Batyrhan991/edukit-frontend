"use client";

import { Coins, Eye, EyeOff, FileCheck2, FileText, LoaderCircle, NotebookPen, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field, TextInput } from "@/components/auth/form-parts";
import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import { intlLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { api, fieldErrors, readProblem, type Credits, type Generation } from "@/lib/api/browser";
import { fmt, formatDateTime } from "@/lib/format";
import { kspErrorKey } from "@/lib/ksp";
import { DIFFICULTIES } from "@/lib/quiz";
import {
  validateWorksheetForm,
  worksheetKeyDoc,
  worksheetStudentDoc,
  type WorksheetDocLabels,
  type WorksheetDocument,
  type WorksheetForm as Form,
} from "@/lib/worksheet";
import { QuestionCards } from "./quiz-generator";

type TQ = Dictionary["quiz"];
type TW = Dictionary["worksheet"];
type ErrorKey = keyof TW["errors"];
const POLL_MS = 1500;
const fieldClass =
  "w-full min-w-0 rounded-sm border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30";

function newKey(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function WorksheetGenerator({
  tq,
  tw,
  locale,
  initialCredits,
  docLabels,
}: {
  tq: TQ;
  tw: TW;
  locale: Locale;
  initialCredits: Credits;
  docLabels: Record<Locale, WorksheetDocLabels>;
}) {
  const [form, setForm] = useState<Form>({ subject: "", grade: "", topic: "", count: "6", difficulty: "medium", theory: true, notes: "", language: locale });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<ErrorKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [credits, setCredits] = useState(initialCredits);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ student: string; key: string } | null>(null);
  const keyRef = useRef<string>(newKey());

  const price = Number(credits.prices.find((p) => p.tool === "worksheet")?.credits ?? 0);
  const balance = Number(credits.balance);
  const reserved = Number(credits.reserved);
  const running = generation?.status === "Pending" || generation?.status === "Running";

  const update = (patch: Partial<Form>) => {
    setForm((current) => ({ ...current, ...patch }));
    keyRef.current = newKey(); // другая форма — другая попытка
  };
  const set = (key: "subject" | "grade" | "topic" | "count" | "notes") => (e: { target: { value: string } }) => update({ [key]: e.target.value } as Partial<Form>);

  async function refreshCredits() {
    const response = await api("GET", "/credits");
    if (response.ok) setCredits((await response.json()) as Credits);
  }

  useEffect(() => {
    if (!generation || !running) return;
    const timer = setTimeout(async () => {
      const response = await api("GET", `/generations/${generation.id}`);
      if (!response.ok) return;
      const next = (await response.json()) as Generation;
      setGeneration(next);
      if (next.status !== "Pending" && next.status !== "Running") {
        setBusy(false);
        if (next.status === "Failed") setError(kspErrorKey(next.errorCode) as ErrorKey);
        if (next.status === "Cancelled") setNotice(tq.cancelled);
        await refreshCredits();
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, running]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const local = validateWorksheetForm(form);
    setErrors(local);
    setError(null);
    setNotice(null);
    setSaved(null);
    if (Object.keys(local).length > 0) return;

    setBusy(true);
    const response = await api(
      "POST",
      "/generators/worksheet",
      {
        subject: form.subject.trim(),
        grade: form.grade.trim(),
        topic: form.topic.trim(),
        taskCount: Number(form.count),
        difficulty: form.difficulty,
        theory: form.theory,
        notes: form.notes.trim() || null,
        language: form.language,
      },
      { "Idempotency-Key": keyRef.current },
    );

    if (response.ok) {
      const created = (await response.json()) as Generation;
      setGeneration(created);
      keyRef.current = newKey();
      if (created.status === "Failed") {
        setBusy(false);
        setError(kspErrorKey(created.errorCode) as ErrorKey);
      }
      await refreshCredits();
      return;
    }

    const problem = await readProblem(response);
    setErrors(fieldErrors(problem));
    setError(problem.errors ? null : (kspErrorKey(problem.code, problem.status) as ErrorKey));
    setBusy(false);
  }

  /** Два документа: лист для учеников (без ответов) и ключ для учителя; подписи — на языке листа. */
  async function save() {
    const ws = generation?.worksheet;
    if (!ws || !generation) return;
    setSaving(true);
    const language = (generation.language as Locale) in docLabels ? (generation.language as Locale) : locale;
    const labels = docLabels[language];
    const create = async (title: string, content: unknown) => {
      const response = await api("POST", "/documents", { title: title.slice(0, 200), kind: "worksheet", content, sourceGenerationId: generation.id });
      return response.ok ? ((await response.json()) as { id: string }).id : null;
    };
    const student = await create(ws.title, worksheetStudentDoc(ws, labels, language));
    const key = student ? await create(fmt(labels.ws.keyDoc, { title: ws.title }), worksheetKeyDoc(ws, labels, language)) : null;
    setSaving(false);
    if (student && key) setSaved({ student, key });
    else setError("unknown");
  }

  async function cancel() {
    if (!generation) return;
    const response = await api("POST", `/generations/${generation.id}/cancel`);
    if (response.ok) setGeneration((await response.json()) as Generation);
  }

  const fieldMessage = (code?: string) => (code ? ((tw.errors as Record<string, string>)[code] ?? tw.errors.unknown) : undefined);
  const ws = generation?.status === "Succeeded" ? (generation.worksheet ?? null) : null;
  const wsLanguage = (generation?.language as Locale | undefined) ?? locale;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="space-y-1 border border-border bg-card p-4 text-sm" data-testid="credits">
          <p className="flex items-center gap-2 text-base font-semibold">
            <Coins aria-hidden className="size-4" />
            {fmt(tq.balance, { balance: String(balance) })}
          </p>
          <p>{fmt(tw.price, { price: String(price) })}</p>
          {reserved > 0 ? <p>{fmt(tq.reserved, { reserved: String(reserved) })}</p> : null}
          <p className="text-muted-foreground">{fmt(tq.cycleEnd, { date: formatDateTime(credits.cycleEnd, intlLocale[locale]) })}</p>
          {credits.testValues ? <p className="text-muted-foreground">{tq.testValues}</p> : null}
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label={tq.subject} error={fieldMessage(errors.subject)}>
            {(a) => <TextInput {...a} name="subject" value={form.subject} onChange={set("subject")} maxLength={200} />}
          </Field>
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label={tq.grade} error={fieldMessage(errors.grade)}>
              {(a) => <TextInput {...a} name="grade" value={form.grade} onChange={set("grade")} maxLength={40} />}
            </Field>
            <Field label={tw.count} error={fieldMessage(errors.taskCount)}>
              {(a) => <TextInput {...a} name="taskCount" type="number" inputMode="numeric" min={3} max={12} value={form.count} onChange={set("count")} />}
            </Field>
          </div>
          <Field label={tq.topic} error={fieldMessage(errors.topic)}>
            {(a) => <textarea {...a} name="topic" rows={2} maxLength={500} className={fieldClass} value={form.topic} onChange={set("topic")} />}
          </Field>
          <label className="flex cursor-pointer items-start gap-2 border border-border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/10">
            <input type="checkbox" className="mt-1" checked={form.theory} onChange={(e) => update({ theory: e.target.checked })} data-testid="ws-theory" />
            <span>
              <span className="block font-medium">{tw.theory}</span>
              <span className="block text-muted-foreground">{tw.theoryHint}</span>
            </span>
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{tq.difficulty}</legend>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <label key={d} className="flex cursor-pointer items-center gap-2 border border-border px-2 py-2 text-sm has-checked:border-primary has-checked:bg-primary/10">
                  <input type="radio" name="difficulty" value={d} checked={form.difficulty === d} onChange={() => update({ difficulty: d })} />
                  {tq.difficulties[d]}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={tq.notes} hint={tq.notesHint} error={fieldMessage(errors.notes)}>
            {(a) => <textarea {...a} name="notes" rows={2} maxLength={1000} className={fieldClass} value={form.notes} onChange={set("notes")} />}
          </Field>
          <Field label={tq.language}>
            {(a) => (
              <select {...a} name="language" className={`${fieldClass} h-10 py-0`} value={form.language} onChange={(e) => update({ language: e.target.value as Locale })}>
                <option value="kk">Қазақша</option>
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            )}
          </Field>
          {error ? <StatePanel variant="error" title={tw.errors[error] ?? tw.errors.unknown} /> : null}
          {notice ? <StatePanel variant="success" title={notice} /> : null}
          <Button type="submit" className="h-10 w-full" disabled={busy || running || balance < price}>
            {busy || running ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <NotebookPen aria-hidden />}
            {busy || running ? tw.generating : tw.submit}
          </Button>
          {balance < price ? <p className="text-sm text-destructive">{tw.errors.insufficient}</p> : null}
        </form>
      </div>

      <div aria-live="polite" className="min-w-0">
        {running ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-4">
            <p className="flex items-center gap-2">
              <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
              {tw.generating}
            </p>
            <Button variant="outline" onClick={cancel}>
              {tq.cancel}
            </Button>
          </div>
        ) : null}
        {ws ? (
          <div className="space-y-4">
            {generation?.mock ? <StatePanel variant="offline" title={tw.mock} /> : null}
            {ws.warnings.length > 0 ? (
              <StatePanel variant="offline" title={tq.warnings}>
                <ul className="list-disc pl-5">
                  {ws.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </StatePanel>
            ) : null}
            {saved ? (
              <div className="flex flex-wrap items-center gap-2 border border-success bg-card p-3" role="status">
                <span className="mr-2 text-sm">{tw.saved}</span>
                <Button asChild variant="secondary">
                  <Link href={`/${locale}/teacher/documents/${saved.student}`}>
                    <FileText aria-hidden />
                    {tw.openStudent}
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/${locale}/teacher/documents/${saved.key}`}>
                    <FileCheck2 aria-hidden />
                    {tw.openKey}
                  </Link>
                </Button>
              </div>
            ) : (
              <Button onClick={save} disabled={saving}>
                {saving ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Save aria-hidden />}
                {saving ? tq.saving : tq.save}
              </Button>
            )}
            <WorksheetView tq={tq} tw={tw} ws={ws} language={wsLanguage} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Лист на экране: памятка, задания (ключ — по кнопке), самооценка. Текст AI — только как текст. */
function WorksheetView({ tq, tw, ws, language }: { tq: TQ; tw: TW; ws: WorksheetDocument; language: Locale }) {
  const [showKey, setShowKey] = useState(false);
  return (
    <article className="space-y-6" data-testid="worksheet-document">
      <header className="space-y-2 border-b border-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight">{ws.title}</h2>
        <p className="text-sm text-muted-foreground">
          {ws.subject} · {ws.grade} · {ws.topic}
        </p>
      </header>
      {ws.theory.trim() ? (
        <section className="space-y-1 border-l-4 border-primary bg-primary/5 p-4" data-testid="worksheet-theory">
          <h3 className="font-semibold">{tw.theoryTitle}</h3>
          <p className="whitespace-pre-line">{ws.theory}</p>
        </section>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{tw.tasksTitle}</h3>
        <Button variant="secondary" onClick={() => setShowKey(!showKey)} aria-expanded={showKey}>
          {showKey ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          {showKey ? tq.hideKey : tq.showKey}
        </Button>
      </div>
      <QuestionCards t={tq} questions={ws.tasks} language={language} showKey={showKey} titleTemplate={tw.taskTitle} />
      <section className="space-y-1 border border-dashed border-border p-4">
        <h3 className="font-semibold">{tw.reflectionTitle}</h3>
        <p>{ws.reflection}</p>
      </section>
      {ws.sources.length > 0 ? (
        <section className="text-sm text-muted-foreground">
          <h3 className="font-medium">{tq.sources}</h3>
          <ul className="list-disc pl-5">
            {ws.sources.map((s) => (
              <li key={s.id}>{s.title}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
