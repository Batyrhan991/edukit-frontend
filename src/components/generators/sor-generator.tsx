"use client";

import { Coins, FileCheck2, FileText, LoaderCircle, Save, Sparkles } from "lucide-react";
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
import { int, validateSorForm, type Mode, type SorForm as Form } from "@/lib/sor";
import { sorKeyDoc, sorTasksDoc } from "@/lib/sor-doc";
import { SorView } from "./sor-view";

type T = Dictionary["sor"];
type ErrorKey = keyof T["errors"];
const POLL_MS = 1500;
const DEFAULTS: Record<Mode, { duration: string; totalPoints: string }> = {
  sor: { duration: "20", totalPoints: "12" },
  soch: { duration: "40", totalPoints: "25" },
};
const fieldClass =
  "w-full min-w-0 rounded-sm border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30";

function newKey(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function SorGenerator({
  t,
  locale,
  initialCredits,
  docLabels,
}: {
  t: T;
  locale: Locale;
  initialCredits: Credits;
  docLabels: Record<Locale, T>;
}) {
  const [form, setForm] = useState<Form>({
    mode: "sor",
    subject: "",
    grade: "",
    section: "",
    quarter: "",
    ...DEFAULTS.sor,
    taskCount: "",
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
  const [saved, setSaved] = useState<{ tasks: string; key: string } | null>(null);
  const keyRef = useRef<string>(newKey());

  const price = Number(credits.prices.find((p) => p.tool === "sor")?.credits ?? 0);
  const balance = Number(credits.balance);
  const reserved = Number(credits.reserved);
  const running = generation?.status === "Pending" || generation?.status === "Running";

  const update = (patch: Partial<Form>) => {
    setForm((current) => ({ ...current, ...patch }));
    keyRef.current = newKey(); // другая форма — другая попытка
  };
  const set = (key: keyof Form) => (e: { target: { value: string } }) => update({ [key]: e.target.value } as Partial<Form>);

  /** Смена вида работы подставляет обычные для него время и балл, если учитель их не менял. */
  function setMode(mode: Mode) {
    const untouched = form.duration === DEFAULTS[form.mode].duration && form.totalPoints === DEFAULTS[form.mode].totalPoints;
    update({ mode, ...(untouched ? DEFAULTS[mode] : {}) });
  }

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
    const local = validateSorForm(form);
    setErrors(local);
    setError(null);
    setNotice(null);
    setSaved(null);
    if (Object.keys(local).length > 0) return;

    setBusy(true);
    const response = await api(
      "POST",
      "/generators/sor",
      {
        mode: form.mode,
        subject: form.subject.trim(),
        grade: form.grade.trim(),
        section: form.section.trim(),
        quarter: int(form.quarter),
        durationMinutes: int(form.duration),
        totalPoints: int(form.totalPoints),
        taskCount: int(form.taskCount),
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

  /** Два документа: задания для учеников (без ответов) и ключ для учителя; подписи — на языке работы. */
  async function save() {
    const sor = generation?.sor;
    if (!sor || !generation) return;
    setSaving(true);
    const labels = docLabels[(generation.language as Locale) in docLabels ? (generation.language as Locale) : locale];
    const create = async (title: string, content: unknown) => {
      const response = await api("POST", "/documents", { title: title.slice(0, 200), kind: "sor", content, sourceGenerationId: generation.id });
      return response.ok ? ((await response.json()) as { id: string }).id : null;
    };
    const tasks = await create(fmt(labels.studentDoc, { title: sor.title }), sorTasksDoc(sor, labels));
    const key = tasks ? await create(fmt(labels.keyDoc, { title: sor.title }), sorKeyDoc(sor, labels)) : null;
    setSaving(false);
    if (tasks && key) setSaved({ tasks, key });
    else setError("unknown");
  }

  async function cancel() {
    if (!generation) return;
    const response = await api("POST", `/generations/${generation.id}/cancel`);
    if (response.ok) setGeneration((await response.json()) as Generation);
  }

  const fieldMessage = (code?: string) => (code ? ((t.errors as Record<string, string>)[code] ?? t.errors.unknown) : undefined);
  const sor = generation?.status === "Succeeded" ? generation.sor : null;

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
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t.mode}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["sor", "soch"] as const).map((mode) => (
                <label
                  key={mode}
                  className="flex cursor-pointer items-center gap-2 border border-border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/10"
                >
                  <input type="radio" name="mode" value={mode} checked={form.mode === mode} onChange={() => setMode(mode)} />
                  {mode === "sor" ? t.modeSor : t.modeSoch}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={t.subject} error={fieldMessage(errors.subject)}>
            {(a) => <TextInput {...a} name="subject" value={form.subject} onChange={set("subject")} maxLength={200} />}
          </Field>
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label={t.grade} error={fieldMessage(errors.grade)}>
              {(a) => <TextInput {...a} name="grade" value={form.grade} onChange={set("grade")} maxLength={40} />}
            </Field>
            <Field label={form.mode === "soch" ? t.quarter : t.quarterOptional} error={fieldMessage(errors.quarter)}>
              {(a) => (
                <select {...a} name="quarter" className={`${fieldClass} h-10 py-0`} value={form.quarter} onChange={set("quarter")}>
                  <option value="">{t.quarterNone}</option>
                  {[1, 2, 3, 4].map((q) => (
                    <option key={q} value={String(q)}>
                      {fmt(t.quarterLine, { n: String(q) })}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <Field label={form.mode === "soch" ? t.sectionSoch : t.section} error={fieldMessage(errors.section)}>
            {(a) => <textarea {...a} name="section" rows={2} maxLength={500} className={fieldClass} value={form.section} onChange={set("section")} />}
          </Field>
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label={t.duration} error={fieldMessage(errors.durationMinutes)}>
              {(a) => <TextInput {...a} name="durationMinutes" type="number" inputMode="numeric" min={10} max={90} value={form.duration} onChange={set("duration")} />}
            </Field>
            <Field label={t.totalPoints} error={fieldMessage(errors.totalPoints)}>
              {(a) => <TextInput {...a} name="totalPoints" type="number" inputMode="numeric" min={5} max={40} value={form.totalPoints} onChange={set("totalPoints")} />}
            </Field>
          </div>
          <Field label={t.taskCount} error={fieldMessage(errors.taskCount)}>
            {(a) => <TextInput {...a} name="taskCount" type="number" inputMode="numeric" min={1} max={15} value={form.taskCount} onChange={set("taskCount")} />}
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
        {sor ? (
          <div className="space-y-4">
            {generation?.mock ? <StatePanel variant="offline" title={t.mock} /> : null}
            {sor.warnings.length > 0 ? (
              <StatePanel variant="offline" title={t.warnings}>
                <ul className="list-disc pl-5">
                  {sor.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </StatePanel>
            ) : null}
            {saved ? (
              <div className="flex flex-wrap items-center gap-2 border border-success bg-card p-3" role="status">
                <span className="mr-2 text-sm">{t.saved}</span>
                <Button asChild variant="secondary">
                  <Link href={`/${locale}/teacher/documents/${saved.tasks}`}>
                    <FileText aria-hidden />
                    {t.openTasks}
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
            <SorView t={t} sor={sor} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
