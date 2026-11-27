"use client";

import { Coins, Eye, EyeOff, FileCheck2, FileText, House, LoaderCircle, Save } from "lucide-react";
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
import {
  homeworkKeyDoc,
  homeworkStudentDoc,
  levelTitle,
  validateHomeworkForm,
  type HomeworkDocLabels,
  type HomeworkDocument,
  type HomeworkForm as Form,
} from "@/lib/homework";
import { QuestionCards } from "./quiz-generator";

type TQ = Dictionary["quiz"];
type TW = Dictionary["homework"];
type ErrorKey = keyof TW["errors"];
const POLL_MS = 1500;
const fieldClass =
  "w-full min-w-0 rounded-sm border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30";

function newKey(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function HomeworkGenerator({
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
  docLabels: Record<Locale, HomeworkDocLabels>;
}) {
  const [form, setForm] = useState<Form>({ subject: "", grade: "", topic: "", perLevel: "2", notes: "", language: locale });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<ErrorKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [credits, setCredits] = useState(initialCredits);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ student: string; key: string } | null>(null);
  const keyRef = useRef<string>(newKey());

  const price = Number(credits.prices.find((p) => p.tool === "homework")?.credits ?? 0);
  const balance = Number(credits.balance);
  const reserved = Number(credits.reserved);
  const running = generation?.status === "Pending" || generation?.status === "Running";

  const update = (patch: Partial<Form>) => {
    setForm((current) => ({ ...current, ...patch }));
    keyRef.current = newKey(); // другая форма — другая попытка
  };
  const set = (key: "subject" | "grade" | "topic" | "perLevel" | "notes") => (e: { target: { value: string } }) => update({ [key]: e.target.value } as Partial<Form>);

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
    const local = validateHomeworkForm(form);
    setErrors(local);
    setError(null);
    setNotice(null);
    setSaved(null);
    if (Object.keys(local).length > 0) return;

    setBusy(true);
    const response = await api(
      "POST",
      "/generators/homework",
      {
        subject: form.subject.trim(),
        grade: form.grade.trim(),
        topic: form.topic.trim(),
        tasksPerLevel: Number(form.perLevel),
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

  /** Два документа: листок для учеников (без ответов) и ключ для учителя; подписи — на языке задания. */
  async function save() {
    const hw = generation?.homework;
    if (!hw || !generation) return;
    setSaving(true);
    const language = (generation.language as Locale) in docLabels ? (generation.language as Locale) : locale;
    const labels = docLabels[language];
    const create = async (title: string, content: unknown) => {
      const response = await api("POST", "/documents", { title: title.slice(0, 200), kind: "homework", content, sourceGenerationId: generation.id });
      return response.ok ? ((await response.json()) as { id: string }).id : null;
    };
    const student = await create(hw.title, homeworkStudentDoc(hw, labels, language));
    const key = student ? await create(fmt(labels.hw.keyDoc, { title: hw.title }), homeworkKeyDoc(hw, labels, language)) : null;
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
  const hw = generation?.status === "Succeeded" ? (generation.homework ?? null) : null;
  const hwLanguage = (generation?.language as Locale | undefined) ?? locale;

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
            <Field label={tw.perLevel} error={fieldMessage(errors.tasksPerLevel)}>
              {(a) => <TextInput {...a} name="tasksPerLevel" type="number" inputMode="numeric" min={1} max={4} value={form.perLevel} onChange={set("perLevel")} />}
            </Field>
          </div>
          <Field label={tq.topic} error={fieldMessage(errors.topic)}>
            {(a) => <textarea {...a} name="topic" rows={2} maxLength={500} className={fieldClass} value={form.topic} onChange={set("topic")} />}
          </Field>
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
            {busy || running ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <House aria-hidden />}
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
        {hw ? (
          <div className="space-y-4">
            {generation?.mock ? <StatePanel variant="offline" title={tw.mock} /> : null}
            {hw.warnings.length > 0 ? (
              <StatePanel variant="offline" title={tq.warnings}>
                <ul className="list-disc pl-5">
                  {hw.warnings.map((w, i) => (
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
            <HomeworkView tq={tq} tw={tw} hw={hw} language={hwLanguage} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Домашнее задание на экране: инструкция и три уровня (ключ — по кнопке). Текст AI — только как текст. */
function HomeworkView({ tq, tw, hw, language }: { tq: TQ; tw: TW; hw: HomeworkDocument; language: Locale }) {
  const [showKey, setShowKey] = useState(false);
  return (
    <article className="space-y-6" data-testid="homework-document">
      <header className="space-y-2 border-b border-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight">{hw.title}</h2>
        <p className="text-sm text-muted-foreground">
          {hw.subject} · {hw.grade} · {hw.topic}
        </p>
        <p>{hw.instructions}</p>
      </header>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setShowKey(!showKey)} aria-expanded={showKey}>
          {showKey ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          {showKey ? tq.hideKey : tq.showKey}
        </Button>
      </div>
      {hw.levels.map((level) => (
        <section key={level.level} className="space-y-3" data-testid="homework-level" data-level={level.level}>
          <div className="border-l-4 border-primary pl-3">
            <h3 className="text-lg font-semibold">{levelTitle(level.level, tw)}</h3>
            <p className="text-sm text-muted-foreground">{level.description}</p>
          </div>
          <QuestionCards t={tq} questions={level.tasks} language={language} showKey={showKey} titleTemplate={tw.taskTitle} />
        </section>
      ))}
      {hw.sources.length > 0 ? (
        <section className="text-sm text-muted-foreground">
          <h3 className="font-medium">{tq.sources}</h3>
          <ul className="list-disc pl-5">
            {hw.sources.map((s) => (
              <li key={s.id}>{s.title}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
