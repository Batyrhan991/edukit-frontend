import { CircleCheck, CircleMinus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingPanel, StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { getSystemInfo } from "@/lib/api/server";

export default async function StatusPage() {
  const { t } = await getDictionary();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t.status.title}</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">{t.status.intro}</p>
      <div className="mt-8">
        {/* Данные запрашиваются при каждом открытии; оболочка страницы отдаётся сразу. */}
        <Suspense fallback={<LoadingPanel label={t.states.loading} />}>
          <SystemModules />
        </Suspense>
      </div>
    </div>
  );
}

async function SystemModules() {
  const { locale, t } = await getDictionary();
  const result = await getSystemInfo();

  if (!result.ok) {
    return (
      <StatePanel
        variant="error"
        title={t.status.unavailableTitle}
        action={
          <Button asChild variant="outline">
            <Link href={`/${locale}/status`}>{t.states.retry}</Link>
          </Button>
        }
      >
        {t.status.unavailableText}
        {result.status ? ` (HTTP ${result.status})` : null}
      </StatePanel>
    );
  }

  const modules = t.status.modules as Record<string, string>;
  const entries = Object.entries(result.data.features);

  return (
    <div data-testid="system-modules">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t.status.apiVersion}</dt>
        <dd>{result.data.apiVersion}</dd>
        <dt className="text-muted-foreground">{t.status.build}</dt>
        <dd className="break-all">{result.data.buildVersion}</dd>
      </dl>
      <h2 className="mb-3 mt-8 text-xl font-semibold">{t.status.modulesTitle}</h2>
      <ul className="divide-y divide-border border border-border bg-card">
        {entries.map(([key, enabled]) => (
          <li key={key} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <span>{modules[key] ?? key}</span>
            <span className="flex items-center gap-1.5 text-sm">
              {enabled ? (
                <CircleCheck aria-hidden className="size-4 text-success" />
              ) : (
                <CircleMinus aria-hidden className="size-4 text-muted-foreground" />
              )}
              {enabled ? t.status.enabled : t.status.disabled}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
