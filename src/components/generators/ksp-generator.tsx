"use client";

import { Coins, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field, TextInput } from "@/components/auth/form-parts";
import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { api, fieldErrors, readProblem, type Credits, type Generation } from "@/lib/api/browser";
import { fmt, formatDateTime } from "@/lib/format";
import { intlLocale } from "@/i18n/config";
import { kspErrorKey, type KspErrorKey } from "@/lib/ksp";
import { KspView } from "./ksp-view";

type T = Dictionary["ksp"];
type ErrorKey = KspErrorKey;

const POLL_MS = 1500;
const fieldClass =
  "w-full min-w-0 rounded-sm border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30";

/** Ключ идемпотентности одной попытки: повтор той же отправки не списывает кредиты дважды. */
function newKey(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

type Form = { subject: string; grade: string; topic: string; duration: string; lessonType: string; objectives: string; notes: string; language: Locale };

export function KspGenerator({ t, locale, initialCredits }: { t: T; locale: Locale; initialCredits: Credits }) {
  const [form, setForm] = useState<Form>({ subject: "", grade: "", topic: "", duration: "45", lessonType: "", objectives: "", notes: "", language: locale });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<ErrorKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [credits, setCredits] = useState(initialCredits);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [busy, setBusy] = useState(false);
  const keyRef = useRef<string>(newKey());

  // В описании API целые числа допускают и строковую запись — приводим явно.
  const price = Number(credits.prices.find((p) => p.tool === "ksp")?.credits ?? 0);
  const balance = Number(credits.balance);
  const reserved = Number(credits.reserved);
  const running = generation?.status === "Pending" || generation?.status === "Running";
  const set = (key: keyof Form) => (e: { target: { value: string } }) => {
    setForm({ ...form, [key]: e.target.value });
    keyRef.current = newKey(); // другая форма — другая попытка
  };

  async function refreshCredits() {
    const response = await api("GET", "/credits");
    if (response.ok) setCredits((await response.json()) as Credits);
  }

  // Опрос состояния идущей генерации.
  useEffect(() => {
    if (!generation || !running) return;
    const timer = setTimeout(async () => {
      const response = await api("GET", `/generations/${generation.id}`);
      if (!response.ok) return;
      const next = (await response.json()) as Generation;
      setGeneration(next);
      if (next.status !== "Pending" && next.status !== "Running") {
        setBusy(false);
        if (next.status === "Failed") setError(kspErrorKey(next.errorCode));
        if (next.status === "Cancelled") setNotice(t.cancelled);
        await refreshCredits();
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, running]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (!form.subject.trim()) local.subject = "required";
    if (!form.grade.trim()) local.grade = "required";
    if (!form.topic.trim()) local.topic = "required";
    const duration = Number(form.duration);
    if (!Number.isInteger(duration) || duration < 20 || duration > 180) local.durationMinutes = "out_of_range";
    setErrors(local);
    setError(null);
    setNotice(null);
    if (Object.keys(local).length > 0) return;

    setBusy(true);
    const objectives = form.objectives.split("\n").map((s) => s.trim()).filter(Boolean);
    const response = await api("POST", "/generators/ksp", {
      subject: form.subject.trim(),
      grade: form.grade.trim(),
      topic: form.topic.trim(),
      durationMinutes: duration,
      lessonType: form.lessonType.trim() || null,
      lessonObjectives: objectives,
      notes: form.notes.trim() || null,
      language: form.language,
    }, { "Idempotency-Key": keyRef.current });

    if (response.ok) {
      const created = (await response.json()) as Generation;
      setGeneration(created);
      keyRef.current = newKey();
      if (created.status === "Failed") {
        setBusy(false);
        setError(kspErrorKey(created.errorCode));
      }
      await refreshCredits();
      return;
    }

    const problem = await readProblem(response);
    setErrors(fieldErrors(problem));
    setError(problem.errors ? null : kspErrorKey(problem.code, problem.status));
    setBusy(false);
  }

  async function cancel() {
    if (!generation) return;
    const response = await api("POST", `/generations/${generation.id}/cancel`);
    if (response.ok) setGeneration((await response.json()) as Generation);
  }

  const fieldMessage = (code?: string) => (code ? ((t.errors as Record<string, string>)[code] ?? t.errors.unknown) : undefined);
  const done = generation?.status === "Succeeded" && generation.ksp;

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
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.grade} error={fieldMessage(errors.grade)}>
              {(a) => <TextInput {...a} name="grade" value={form.grade} onChange={set("grade")} maxLength={40} />}
            </Field>
            <Field label={t.duration} error={fieldMessage(errors.durationMinutes)}>
              {(a) => <TextInput {...a} name="durationMinutes" type="number" inputMode="numeric" min={20} max={180} value={form.duration} onChange={set("duration")} />}
            </Field>
          </div>
          <Field label={t.topic} error={fieldMessage(errors.topic)}>
            {(a) => <TextInput {...a} name="topic" value={form.topic} onChange={set("topic")} maxLength={200} />}
          </Field>
          <Field label={t.lessonType} error={fieldMessage(errors.lessonType)}>
            {(a) => <TextInput {...a} name="lessonType" value={form.lessonType} onChange={set("lessonType")} maxLength={200} />}
          </Field>
          <Field label={t.objectives} error={fieldMessage(errors.lessonObjectives)}>
            {(a) => <textarea {...a} name="objectives" rows={3} className={fieldClass} value={form.objectives} onChange={set("objectives")} />}
          </Field>
          <Field label={t.notes} hint={t.notesHint} error={fieldMessage(errors.notes)}>
            {(a) => <textarea {...a} name="notes" rows={3} maxLength={1000} className={fieldClass} value={form.notes} onChange={set("notes")} />}
          </Field>
          <Field label={t.language} error={fieldMessage(errors.language)}>
            {(a) => (
              <select {...a} name="language" className={`${fieldClass} h-10 py-0`} value={form.language} onChange={set("language")}>
                <option value="kk">Қазақша</option>
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            )}
          </Field>
          {error ? <StatePanel variant="error" title={t.errors[error]} /> : null}
          {notice ? <StatePanel variant="success" title={notice} /> : null}
          <Button type="submit" className="h-10 w-full" disabled={busy || running || balance < price}>
            {busy || running ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Sparkles aria-hidden />}
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
        {done ? (
          <div className="space-y-4">
            {generation.mock ? <StatePanel variant="offline" title={t.mock} /> : null}
            {generation.ksp!.warnings.length > 0 ? (
              <StatePanel variant="offline" title={t.warnings}>
                <ul className="list-disc pl-5">
                  {generation.ksp!.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </StatePanel>
            ) : null}
            <KspView t={t} ksp={generation.ksp!} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
