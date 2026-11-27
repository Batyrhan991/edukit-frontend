"use client";

import { Coins, Eye, EyeOff, FileCheck2, FileText, ListChecks, LoaderCircle, Save } from "lucide-react";
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
  answerText,
  DIFFICULTIES,
  optionLetter,
  QUIZ_TYPES,
  quizKeyDoc,
  quizStudentDoc,
  shuffledRight,
  validateQuizForm,
  type QuizDocument,
  type QuizForm as Form,
  type QuizType,
} from "@/lib/quiz";

type T = Dictionary["quiz"];
type ErrorKey = keyof T["errors"];
const POLL_MS = 1500;
const fieldClass =
  "w-full min-w-0 rounded-sm border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30";

function newKey(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function QuizGenerator({ t, locale, initialCredits, docLabels }: { t: T; locale: Locale; initialCredits: Credits; docLabels: Record<Locale, T> }) {
  const [form, setForm] = useState<Form>({
    subject: "",
    grade: "",
    topic: "",
    count: "10",
    types: ["single", "multiple", "true_false", "fill", "matching", "open"],
    difficulty: "medium",
    notes: "",
    language: locale,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<ErrorKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [credits, setCredits] = useState(initialCredits);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ student: string; key: string } | null>(null);
  const keyRef = useRef<string>(newKey());

  const price = Number(credits.prices.find((p) => p.tool === "test")?.credits ?? 0);
  const balance = Number(credits.balance);
  const reserved = Number(credits.reserved);
  const running = generation?.status === "Pending" || generation?.status === "Running";

  const update = (patch: Partial<Form>) => {
    setForm((current) => ({ ...current, ...patch }));
    keyRef.current = newKey(); // другая форма — другая попытка
  };
  const set = (key: "subject" | "grade" | "topic" | "count" | "notes") => (e: { target: { value: string } }) => update({ [key]: e.target.value } as Partial<Form>);
  const toggleType = (type: QuizType) =>
    update({ types: form.types.includes(type) ? form.types.filter((x) => x !== type) : QUIZ_TYPES.filter((x) => x === type || form.types.includes(x)) });

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
        if (next.status === "Cancelled") setNotice(t.cancelled);
        await refreshCredits();
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, running]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const local = validateQuizForm(form);
    setErrors(local);
    setError(null);
    setNotice(null);
    setSaved(null);
    if (Object.keys(local).length > 0) return;

    setBusy(true);
    const response = await api(
      "POST",
      "/generators/test",
      {
        subject: form.subject.trim(),
        grade: form.grade.trim(),
        topic: form.topic.trim(),
        questionCount: Number(form.count),
        types: form.types,
        difficulty: form.difficulty,
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

  /** Два документа: вариант для учеников (без ответов) и ключ для учителя; подписи — на языке теста. */
  async function save() {
    const test = generation?.test;
    if (!test || !generation) return;
    setSaving(true);
    const language = (generation.language as Locale) in docLabels ? (generation.language as Locale) : locale;
    const labels = docLabels[language];
    const create = async (title: string, content: unknown) => {
      const response = await api("POST", "/documents", { title: title.slice(0, 200), kind: "test", content, sourceGenerationId: generation.id });
      return response.ok ? ((await response.json()) as { id: string }).id : null;
    };
    const student = await create(fmt(labels.studentDoc, { title: test.title }), quizStudentDoc(test, labels, language));
    const key = student ? await create(fmt(labels.keyDoc, { title: test.title }), quizKeyDoc(test, labels, language)) : null;
    setSaving(false);
    if (student && key) setSaved({ student, key });
    else setError("unknown");
  }

  async function cancel() {
    if (!generation) return;
    const response = await api("POST", `/generations/${generation.id}/cancel`);
    if (response.ok) setGeneration((await response.json()) as Generation);
  }

  const fieldMessage = (code?: string) => (code ? ((t.errors as Record<string, string>)[code] ?? t.errors.unknown) : undefined);
  const test = generation?.status === "Succeeded" ? (generation.test ?? null) : null;
  const testLanguage = (generation?.language as Locale | undefined) ?? locale;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="space-y-1 border border-border bg-card p-4 text-sm" data-testid="credits">
          <p className="flex items-center gap-2 text-base font-semibold">
            <Coins aria-hidden className="size-4" />
            {fmt(t.balance, { balance: String(balance) })}
          </p>
          <p>{fmt(t.price, { price: String(price) })}</p>
          {reserved > 0 ? <p>{fmt(t.reserved, { reserved: String(reserved) })}</p> : null}
          <p className="text-muted-foreground">{fmt(t.cycleEnd, { date: formatDateTime(credits.cycleEnd, intlLocale[locale]) })}</p>
          {credits.testValues ? <p className="text-muted-foreground">{t.testValues}</p> : null}
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label={t.subject} error={fieldMessage(errors.subject)}>
            {(a) => <TextInput {...a} name="subject" value={form.subject} onChange={set("subject")} maxLength={200} />}
          </Field>
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label={t.grade} error={fieldMessage(errors.grade)}>
              {(a) => <TextInput {...a} name="grade" value={form.grade} onChange={set("grade")} maxLength={40} />}
            </Field>
            <Field label={t.count} error={fieldMessage(errors.questionCount)}>
              {(a) => <TextInput {...a} name="questionCount" type="number" inputMode="numeric" min={3} max={30} value={form.count} onChange={set("count")} />}
            </Field>
          </div>
          <Field label={t.topic} error={fieldMessage(errors.topic)}>
            {(a) => <textarea {...a} name="topic" rows={2} maxLength={500} className={fieldClass} value={form.topic} onChange={set("topic")} />}
          </Field>
          <fieldset className="space-y-2" aria-describedby="quiz-types-hint">
            <legend className="text-sm font-medium">{t.typesLabel}</legend>
            <div className="grid gap-1.5">
              {QUIZ_TYPES.map((type) => (
                <label key={type} className="flex cursor-pointer items-center gap-2 border border-border px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary/10">
                  <input type="checkbox" checked={form.types.includes(type)} onChange={() => toggleType(type)} data-testid={`quiz-type-${type}`} />
                  {t.types[type]}
                </label>
              ))}
            </div>
            <p id="quiz-types-hint" className="text-sm text-muted-foreground">
              {t.typesHint}
            </p>
            {errors.types ? (
              <p className="text-sm text-destructive" role="alert">
                {fieldMessage(errors.types)}
              </p>
            ) : null}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t.difficulty}</legend>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <label key={d} className="flex cursor-pointer items-center gap-2 border border-border px-2 py-2 text-sm has-checked:border-primary has-checked:bg-primary/10">
                  <input type="radio" name="difficulty" value={d} checked={form.difficulty === d} onChange={() => update({ difficulty: d })} />
                  {t.difficulties[d]}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={t.notes} hint={t.notesHint} error={fieldMessage(errors.notes)}>
            {(a) => <textarea {...a} name="notes" rows={2} maxLength={1000} className={fieldClass} value={form.notes} onChange={set("notes")} />}
          </Field>
          <Field label={t.language}>
            {(a) => (
              <select {...a} name="language" className={`${fieldClass} h-10 py-0`} value={form.language} onChange={(e) => update({ language: e.target.value as Locale })}>
                <option value="kk">Қазақша</option>
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            )}
          </Field>
          {error ? <StatePanel variant="error" title={t.errors[error] ?? t.errors.unknown} /> : null}
          {notice ? <StatePanel variant="success" title={notice} /> : null}
          <Button type="submit" className="h-10 w-full" disabled={busy || running || balance < price}>
            {busy || running ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <ListChecks aria-hidden />}
            {busy || running ? t.generating : t.submit}
          </Button>
          {balance < price ? <p className="text-sm text-destructive">{t.errors.insufficient}</p> : null}
        </form>
      </div>

      <div aria-live="polite" className="min-w-0">
        {running ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-4">
            <p className="flex items-center gap-2">
              <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
              {t.generating}
            </p>
            <Button variant="outline" onClick={cancel}>
              {t.cancel}
            </Button>
          </div>
        ) : null}
        {test ? (
          <div className="space-y-4">
            {generation?.mock ? <StatePanel variant="offline" title={t.mock} /> : null}
            {test.warnings.length > 0 ? (
              <StatePanel variant="offline" title={t.warnings}>
                <ul className="list-disc pl-5">
                  {test.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </StatePanel>
            ) : null}
            {saved ? (
              <div className="flex flex-wrap items-center gap-2 border border-success bg-card p-3" role="status">
                <span className="mr-2 text-sm">{t.saved}</span>
                <Button asChild variant="secondary">
                  <Link href={`/${locale}/teacher/documents/${saved.student}`}>
                    <FileText aria-hidden />
                    {t.openStudent}
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/${locale}/teacher/documents/${saved.key}`}>
                    <FileCheck2 aria-hidden />
                    {t.openKey}
                  </Link>
                </Button>
              </div>
            ) : (
              <Button onClick={save} disabled={saving}>
                {saving ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Save aria-hidden />}
                {saving ? t.saving : t.save}
              </Button>
            )}
            <QuizView t={t} test={test} language={testLanguage} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Тест на экране: вопросы как в ученическом варианте; ключ (ответы, пояснения) скрыт, пока учитель его не откроет, —
 * экран можно показать классу. Текст AI выводится только как текст (React его экранирует).
 */
function QuizView({ t, test, language }: { t: T; test: QuizDocument; language: Locale }) {
  const [showKey, setShowKey] = useState(false);
  const total = test.questions.reduce((sum, q) => sum + Number(q.points), 0);
  return (
    <article className="space-y-6" data-testid="quiz-document">
      <header className="space-y-2 border-b border-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight">{test.title}</h2>
        <p className="text-sm text-muted-foreground">
          {test.subject} · {test.grade} · {test.topic} · {fmt(t.totalLine, { n: String(total) })}
        </p>
      </header>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setShowKey(!showKey)} aria-expanded={showKey}>
          {showKey ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          {showKey ? t.hideKey : t.showKey}
        </Button>
      </div>
      <QuestionCards t={t} questions={test.questions} language={language} showKey={showKey} titleTemplate={t.questionTitle} />
      {test.sources.length > 0 ? (
        <section className="text-sm text-muted-foreground">
          <h3 className="font-medium">{t.sources}</h3>
          <ul className="list-disc pl-5">
            {test.sources.map((s) => (
              <li key={s.id}>{s.title}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

/** Карточки заданий (общие для тестов и рабочих листов): текст, варианты с буквами, соответствие; ключ — по флагу. */
export function QuestionCards({
  t,
  questions,
  language,
  showKey,
  titleTemplate,
}: {
  t: T;
  questions: readonly QuizDocument["questions"][number][];
  language: Locale;
  showKey: boolean;
  titleTemplate: string;
}) {
  return (
    <ol className="space-y-4">
      {questions.map((q) => (
        <li key={String(q.number)} className="space-y-2 border border-border bg-card p-4" data-testid="quiz-question" data-type={q.type}>
          <p className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold">{fmt(titleTemplate, { n: String(q.number) })}</span>
            <span className="text-sm text-muted-foreground">
              {t.types[q.type as keyof T["types"]] ?? q.type} · {fmt(t.points, { n: String(q.points) })}
            </span>
          </p>
          <p className="whitespace-pre-line">{q.text}</p>
          {q.type === "single" || q.type === "multiple" ? (
            <ul className="space-y-1">
              {q.options.map((o, i) => (
                <li key={i}>
                  {optionLetter(i, language)}) {o}
                </li>
              ))}
            </ul>
          ) : null}
          {q.type === "matching" ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <ol className="list-decimal space-y-1 pl-5">
                {q.pairs.map((p, i) => (
                  <li key={i}>{p.left}</li>
                ))}
              </ol>
              <ul className="space-y-1">
                {shuffledRight(q).map((r, i) => (
                  <li key={i}>
                    {optionLetter(i, language)}) {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {showKey ? (
            <div className="space-y-1 border-t border-border pt-2 text-sm" data-testid="quiz-key">
              <p className="whitespace-pre-line">
                <span className="font-medium">{t.answer}:</span> {answerText(q, t, language)}
              </p>
              {q.explanation ? (
                <p>
                  <span className="font-medium">{t.explanation}:</span> {q.explanation}
                </p>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
