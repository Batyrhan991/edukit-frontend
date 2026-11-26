import type { Dictionary } from "@/i18n/dictionaries";
import type { KspDocument } from "@/lib/api/browser";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

type T = Dictionary["ksp"];

const kindTone: Record<string, string> = {
  teacher: "border-l-primary",
  students: "border-l-emerald-600 dark:border-l-emerald-400",
  task: "border-l-amber-600 dark:border-l-amber-400",
  note: "border-l-border",
};

function List({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="font-semibold">{title}</h3>
      <ul className="list-disc space-y-1 pl-5">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function Paragraph({ title, text }: { title: string; text?: string | null }) {
  if (!text) return null;
  return (
    <section className="space-y-1">
      <h3 className="font-semibold">{title}</h3>
      <p className="whitespace-pre-line">{text}</p>
    </section>
  );
}

/**
 * КСП по структуре образца владельца (ADR-0035): шапка, цели, «Паспорт урока», «Ход урока».
 * Текст AI выводится только как текст (React экранирует его) — разметка и скрипты из ответа не исполняются.
 */
export function KspView({ t, ksp }: { t: T; ksp: KspDocument }) {
  return (
    <article className="space-y-8" data-testid="ksp-document">
      <header className="space-y-2 border-b border-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight">{ksp.topic}</h2>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{t.subject}</dt>
            <dd className="font-medium">{ksp.subject}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.grade}</dt>
            <dd className="font-medium">{ksp.grade}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.lessonTypeTitle}</dt>
            <dd className="font-medium">{ksp.lessonType}</dd>
          </div>
        </dl>
      </header>

      <List title={t.lessonObjectives} items={ksp.lessonObjectives} />
      {ksp.learningObjectives.length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-semibold">{t.learningObjectives}</h3>
          <ul className="space-y-1">
            {ksp.learningObjectives.map((o) => (
              <li key={o.code}>
                <span className="mr-2 font-mono text-sm">{o.code}</span>
                {o.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-xl font-semibold">{t.passport}</h3>
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{t.stage}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t.minutes}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t.teacherActivity}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t.studentActivity}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card align-top">
              {ksp.passport.map((p, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-medium">{p.stage}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmt(t.minutesShort, { n: String(p.minutes) })}</td>
                  <td className="px-3 py-2">{p.teacherActivity}</td>
                  <td className="px-3 py-2">{p.studentActivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-semibold">{t.flow}</h3>
        {ksp.flow.map((stage, i) => (
          <section key={i} className="space-y-2">
            <h4 className="font-semibold">{stage.stage}</h4>
            {stage.blocks.map((block, j) => (
              <div key={j} className={cn("border-l-4 bg-card py-1.5 pl-3", kindTone[block.kind] ?? kindTone.note)}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {block.label ?? (t.kind as Record<string, string>)[block.kind] ?? block.kind}
                </p>
                <p className="whitespace-pre-line">{block.text}</p>
              </div>
            ))}
          </section>
        ))}
      </section>

      <Paragraph title={t.differentiation} text={ksp.differentiation} />
      <Paragraph title={t.assessment} text={ksp.assessment} />
      <Paragraph title={t.homework} text={ksp.homework} />
      <List title={t.resources} items={ksp.resources} />
      <List title={t.sources} items={ksp.sources.map((s) => s.title)} />
    </article>
  );
}
