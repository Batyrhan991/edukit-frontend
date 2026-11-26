"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";
import type { SorDocument } from "@/lib/api/browser";
import { fmt } from "@/lib/format";

type T = Dictionary["sor"];

const n = (value: number | string | null | undefined) => String(Number(value ?? 0));

/**
 * СОР/СОЧ: шапка, цели, критерии и задания. Ключ (ответы, дескрипторы, баллы) скрыт, пока учитель его не откроет, —
 * чтобы экран можно было показать классу. Текст AI выводится только как текст (React его экранирует).
 */
export function SorView({ t, sor }: { t: T; sor: SorDocument }) {
  const [showKey, setShowKey] = useState(false);
  const level = (key: string) => (t.levels as Record<string, string>)[key] ?? key;

  return (
    <article className="space-y-8" data-testid="sor-document">
      <header className="space-y-2 border-b border-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight">{sor.title}</h2>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{t.subjectLine}</dt>
            <dd className="font-medium">{sor.subject}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.gradeLine}</dt>
            <dd className="font-medium">{sor.grade}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.sectionLine}</dt>
            <dd className="font-medium">{sor.section}</dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          {sor.quarter !== null && sor.quarter !== undefined ? `${fmt(t.quarterLine, { n: n(sor.quarter) })} · ` : null}
          {fmt(t.durationLine, { n: n(sor.durationMinutes) })} · <strong className="text-foreground">{fmt(t.totalLine, { n: n(sor.totalPoints) })}</strong>
        </p>
      </header>

      {sor.learningObjectives.length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-semibold">{t.learningObjectives}</h3>
          <ul className="list-disc space-y-1 pl-5">
            {sor.learningObjectives.map((o) => (
              <li key={o.code}>
                <span className="font-medium">{o.code}</span> {o.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="font-semibold">{t.criteria}</h3>
        <ol className="list-decimal space-y-1 pl-5">
          {sor.assessmentCriteria.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{t.tasks}</h3>
          <Button variant="secondary" onClick={() => setShowKey(!showKey)} aria-expanded={showKey}>
            {showKey ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            {showKey ? t.hideKey : t.showKey}
          </Button>
        </div>
        <ol className="space-y-4">
          {sor.tasks.map((task) => (
            <li key={n(task.number)} className="space-y-2 border border-border bg-card p-4" data-testid="sor-task">
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{fmt(t.taskTitle, { n: n(task.number) })}</span>
                <span className="text-sm text-muted-foreground">{fmt(t.points, { n: n(task.points) })}</span>
              </p>
              <p className="whitespace-pre-line">{task.text}</p>
              {showKey ? (
                <div className="space-y-2 border-t border-border pt-2 text-sm" data-testid="sor-key">
                  <p>
                    <span className="font-medium">{t.thinkingLevel}:</span> {level(task.thinkingLevel)}
                  </p>
                  <p>
                    <span className="font-medium">{t.criterionHeader}:</span> {sor.assessmentCriteria[Number(task.criterion) - 1]}
                  </p>
                  <p className="whitespace-pre-line">
                    <span className="font-medium">{t.answer}:</span> {task.answer}
                  </p>
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-muted">
                        <th scope="col" className="border border-border px-2 py-1 font-medium">{t.descriptor}</th>
                        <th scope="col" className="w-20 border border-border px-2 py-1 font-medium">{t.pointsHeader}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {task.descriptors.map((d, i) => (
                        <tr key={i}>
                          <td className="border border-border px-2 py-1">{d.text}</td>
                          <td className="border border-border px-2 py-1">{n(d.points)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {sor.sources.length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-semibold">{t.sources}</h3>
          <ul className="list-disc space-y-1 pl-5">
            {sor.sources.map((s) => (
              <li key={s.id}>{s.title}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
