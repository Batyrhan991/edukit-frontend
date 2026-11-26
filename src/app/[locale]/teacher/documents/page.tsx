import { FileText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoadingPanel, StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import { intlLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { listDocuments } from "@/lib/api/server";
import { fmt, formatDateTime } from "@/lib/format";

export default async function DocumentsPage() {
  const { locale, t } = await getDictionary();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <Link className="text-sm text-primary underline-offset-4 hover:underline" href={`/${locale}/teacher`}>
        {t.ksp.back}
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.documents.title}</h1>
          <p className="mt-2 max-w-prose text-muted-foreground">{t.documents.intro}</p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/teacher/ksp`}>{t.cabinet.kspLink}</Link>
        </Button>
      </div>
      <div className="mt-8">
        <Suspense fallback={<LoadingPanel label={t.states.loading} />}>
          <Documents />
        </Suspense>
      </div>
    </div>
  );
}

async function Documents() {
  const { locale, t } = await getDictionary();
  const documents = await listDocuments();
  if (!documents.ok) {
    if (documents.reason === "unauthorized") redirect(`/${locale}/login?next=/${locale}/teacher/documents`);
    if (documents.reason === "forbidden") return <StatePanel variant="forbidden" title={t.states.forbiddenTitle}>{t.ksp.errors.forbidden}</StatePanel>;
    return <StatePanel variant="error" title={documents.reason === "disabled" ? t.documents.errors.disabled : t.auth.errors.unavailable} />;
  }

  if (documents.data.length === 0) {
    return <StatePanel variant="empty" title={t.documents.empty} />;
  }

  return (
    <ul className="divide-y divide-border border border-border bg-card" data-testid="documents">
      {documents.data.map((d) => (
        <li key={d.id}>
          <Link href={`/${locale}/teacher/documents/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted focus-visible:bg-muted">
            <FileText aria-hidden className="size-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{d.title}</span>
              <span className="block text-sm text-muted-foreground">
                {fmt(t.documents.updated, { date: formatDateTime(d.updatedAt, intlLocale[locale]) })}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
