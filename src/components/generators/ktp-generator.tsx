"use client";

import { CalendarDays, Coins, FileText, LoaderCircle, Save } from "lucide-react";
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
import { ACADEMIC_YEARS, byQuarter, lessonDate, PERIODS, validateKtpForm, WEEKDAY_KEYS, WEEKDAYS, type KtpForm as Form, type KtpPlan } from "@/lib/ktp";
import { ktpDoc, periodLabel } from "@/lib/ktp-doc";

type T = Dictionary["ktp"];
type ErrorKey = keyof T["errors"];
const POLL_MS = 1500;
const fieldClass =
  "w-full min-w-0 rounded-sm border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30";

function newKey(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function KtpGenerator({ t, locale, initialCredits, docLabels }: { t: T; locale: Locale; initialCredits: Credits; docLabels: Record<Locale, T> }) {
  const [form, setForm] = useState<Form>({
    subject: "",
    grade: "",
    academicYear: ACADEMIC_YEARS[0],
    period: "q1",
    weekdays: [1, 4],
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
  const [saved, setSaved] = useState<string | null>(null);
  const keyRef = useRef<string>(newKey());

  const price = Number(credits.prices.find((p) => p.tool === "ktp")?.credits ?? 0);
  const balance = Number(credits.balance);
  const reserved = Number(credits.reserved);
  const running = generation?.status === "Pending" || generation?.status === "Running";

  const update = (patch: Partial<Form>) => {
    setForm((current) => ({ ...current, ...patch }));
    keyRef.current = newKey(); // другая форма — другая попытка
  };
  const set = (key: "subject" | "grade" | "notes" | "academicYear") => (e: { target: { value: string } }) => update({ [key]: e.target.value } as Partial<Form>);
  const toggleDay = (day: number) =>
    update({ weekdays: form.weekdays.includes(day) ? form.weekdays.filter((d) => d !== day) : [...form.weekdays, day].sort((a, b) => a - b) });

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
    const local = validateKtpForm(form);
    setErrors(local);
    setError(null);
    setNotice(null);
    setSaved(null);
    if (Object.keys(local).length > 0) return;

    setBusy(true);
    const response = await api(
      "POST",
      "/generators/ktp",
      {
        subject: form.subject.trim(),
        grade: form.grade.trim(),
        academicYear: form.academicYear,
        period: form.period,
        weekdays: form.weekdays,
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
    setError(problem.errors ? null : problem.code === "ktp.no_lessons" ? "noLessons" : (kspErrorKey(problem.code, problem.status) as ErrorKey));
    setBusy(false);
  }

  /** Документ получает подписи на языке самого плана. */
  async function save() {
    const plan = generation?.ktp;
    if (!plan || !generation) return;
    setSaving(true);
    const labels = docLabels[(generation.language as Locale) in docLabels ? (generation.language as Locale) : locale];
    const response = await api("POST", "/documents", {
      title: fmt(labels.docTitle, { title: plan.title }).slice(0, 200),
      kind: "ktp",
      content: ktpDoc(plan, labels),
      sourceGenerationId: generation.id,
    });
    setSaving(false);
    if (response.ok) setSaved(((await response.json()) as { id: string }).id);
    else setError("unknown");
  }

  async function cancel() {
    if (!generation) return;
    const response = await api("POST", `/generations/${generation.id}/cancel`);
    if (response.ok) setGeneration((await response.json()) as Generation);
  }

  const fieldMessage = (code?: string) => (code ? ((t.errors as Record<string, string>)[code] ?? t.errors.unknown) : undefined);
  const plan = generation?.status === "Succeeded" ? (generation.ktp ?? null) : null;

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
            <Field label={t.academicYear} error={fieldMessage(errors.academicYear)}>
              {(a) => (
                <select {...a} name="academicYear" className={`${fieldClass} h-10 py-0`} value={form.academicYear} onChange={set("academicYear")}>
                  {ACADEMIC_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t.period}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
              {PERIODS.map((p) => (
                <label
                  key={p}
                  className="flex cursor-pointer items-center gap-2 border border-border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/10"
                >
                  <input type="radio" name="period" value={p} checked={form.period === p} onChange={() => update({ period: p })} />
                  {periodLabel(p, t)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2" aria-describedby="ktp-weekdays-hint">
            <legend className="text-sm font-medium">{t.weekdays}</legend>
            <div className="grid grid-cols-6 gap-1">
              {WEEKDAYS.map((day, i) => (
                <label
                  key={day}
                  className="flex cursor-pointer flex-col items-center gap-1 border border-border py-2 text-sm has-checked:border-primary has-checked:bg-primary/10"
                >
                  <input type="checkbox" checked={form.weekdays.includes(day)} onChange={() => toggleDay(day)} data-testid={`ktp-day-${day}`} />
                  {t[WEEKDAY_KEYS[i]]}
                </label>
              ))}
            </div>
            <p id="ktp-weekdays-hint" className="text-sm text-muted-foreground">
              {t.weekdaysHint}
            </p>
            {errors.weekdays ? (
              <p className="text-sm text-destructive" role="alert">
                {fieldMessage(errors.weekdays)}
              </p>
            ) : null}
          </fieldset>
          <Field label={t.notes} hint={t.notesHint} error={fieldMessage(errors.notes)}>
            {(a) => <textarea {...a} name="notes" rows={3} maxLength={1000} className={fieldClass} value={form.notes} onChange={set("notes")} />}
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
            {busy || running ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <CalendarDays aria-hidden />}
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
        {plan ? (
          <div className="space-y-4">
            {generation?.mock ? <StatePanel variant="offline" title={t.mock} /> : null}
            {plan.warnings.length > 0 ? (
              <StatePanel variant="offline" title={t.warnings}>
                <ul className="list-disc pl-5">
                  {plan.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </StatePanel>
            ) : null}
            {saved ? (
              <div className="flex flex-wrap items-center gap-2 border border-success bg-card p-3" role="status">
                <span className="mr-2 text-sm">{t.saved}</span>
                <Button asChild variant="secondary">
                  <Link href={`/${locale}/teacher/documents/${saved}`}>
                    <FileText aria-hidden />
                    {t.open}
                  </Link>
                </Button>
              </div>
            ) : (
              <Button onClick={save} disabled={saving}>
                {saving ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Save aria-hidden />}
                {saving ? t.saving : t.save}
              </Button>
            )}
            <KtpView t={t} plan={plan} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** План по четвертям: таблица уроков с датами. Текст AI выводится только как текст (React его экранирует). */
function KtpView({ t, plan }: { t: T; plan: KtpPlan }) {
  const hours = plan.rows.reduce((sum, r) => sum + Number(r.hours), 0);
  return (
    <article className="space-y-6" data-testid="ktp-document">
      <header className="space-y-2 border-b border-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight">{plan.title}</h2>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">{t.subjectLine}</dt>
            <dd className="font-medium">{plan.subject}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.gradeLine}</dt>
            <dd className="font-medium">{plan.grade}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.yearLine}</dt>
            <dd className="font-medium">{plan.academicYear}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.periodLine}</dt>
            <dd className="font-medium">{periodLabel(plan.period, t)}</dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground" data-testid="ktp-hours">
          {fmt(t.hoursLine, { n: String(hours) })}
        </p>
      </header>
      {byQuarter(plan.rows).map((group) => (
        <section key={group.quarter} className="space-y-2">
          <h3 className="text-lg font-semibold">
            {fmt(t.quarterHeading, { n: String(group.quarter) })} · {fmt(t.lessonsCount, { n: String(group.rows.length) })}
          </h3>
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  {[t.colNumber, t.colDate, t.colSection, t.colTopic, t.colObjectives, t.colHours, t.colNotes].map((h) => (
                    <th key={h} scope="col" className="border-b border-border px-2 py-1.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((r) => (
                  <tr key={String(r.number)} className="align-top odd:bg-card">
                    <td className="border-b border-border px-2 py-1.5 tabular-nums">{String(r.number)}</td>
                    <td className="border-b border-border px-2 py-1.5 tabular-nums whitespace-nowrap">{lessonDate(r.date)}</td>
                    <td className="border-b border-border px-2 py-1.5">{r.section}</td>
                    <td className="border-b border-border px-2 py-1.5">{r.topic}</td>
                    <td className="border-b border-border px-2 py-1.5 tabular-nums">{r.objectives.join(", ")}</td>
                    <td className="border-b border-border px-2 py-1.5 tabular-nums">{String(r.hours)}</td>
                    <td className="border-b border-border px-2 py-1.5">{r.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {plan.sources.length > 0 ? (
        <section className="text-sm text-muted-foreground">
          <h3 className="font-medium">{t.sources}</h3>
          <ul className="list-disc pl-5">
            {plan.sources.map((s) => (
              <li key={s.id}>{s.title}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
