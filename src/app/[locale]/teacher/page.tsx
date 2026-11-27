import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/account-actions";
import { LoadingPanel, StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { FileText } from "lucide-react";
import { intlLocale } from "@/i18n/config";
import { getMe, listDocuments } from "@/lib/api/server";
import { fmt, formatDateTime } from "@/lib/format";

export default async function TeacherPage() {
  const { t } = await getDictionary();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <Suspense fallback={<LoadingPanel label={t.states.loading} />}>
        <TeacherHome />
      </Suspense>
    </div>
  );
}

/**
 * Кабинет учителя. Права проверяет API: без действующей сессии /me отвечает 401 и мы ведём на вход.
 * Наполнение (AI, документы, игры, журнал) появится в следующих этапах.
 */
async function TeacherHome() {
  const { locale, t } = await getDictionary();
  const me = await getMe();

  if (!me.ok) {
    if (me.reason === "unauthorized") redirect(`/${locale}/login?next=/${locale}/teacher`);
    return (
      <StatePanel variant="error" title={me.reason === "disabled" ? t.auth.errors.moduleDisabled : t.auth.errors.unavailable} />
    );
  }

  return (
    <section aria-labelledby="cabinet-title" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{t.cabinet.title}</p>
          <h1 id="cabinet-title" className="text-3xl font-bold tracking-tight">
            {fmt(t.cabinet.greeting, { name: me.data.firstName })}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {me.data.baseRole === "PlatformAdmin" ? (
            <Button asChild>
              <Link href={`/${locale}/admin`}>{t.admin.title}</Link>
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <Link href={`/${locale}/settings/security`}>{t.cabinet.securityLink}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/${locale}/settings/sessions`}>{t.cabinet.sessionsLink}</Link>
          </Button>
          <LogoutButton label={t.cabinet.logout} locale={locale} />
        </div>
      </div>
      <div className="squared-paper border border-border p-6">
        <div className="max-w-prose space-y-4 bg-card p-4">
          <p>{t.cabinet.intro}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/${locale}/teacher/ksp`}>{t.cabinet.kspLink}</Link>
            </Button>
            <Button asChild>
              <Link href={`/${locale}/teacher/sor`}>{t.cabinet.sorLink}</Link>
            </Button>
            <Button asChild>
              <Link href={`/${locale}/teacher/ktp`}>{t.cabinet.ktpLink}</Link>
            </Button>
            <Button asChild>
              <Link href={`/${locale}/teacher/test`}>{t.cabinet.testLink}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/${locale}/teacher/documents`}>{t.cabinet.documentsLink}</Link>
            </Button>
          </div>
        </div>
      </div>
      <Suspense fallback={null}>
        <RecentDocuments />
      </Suspense>
    </section>
  );
}

/** Три последних документа. Если документы выключены или недоступны — блок просто не показывается. */
async function RecentDocuments() {
  const { locale, t } = await getDictionary();
  const documents = await listDocuments({ limit: 3 });
  if (!documents.ok || documents.data.items.length === 0) return null;
  return (
    <section aria-labelledby="recent-documents" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="recent-documents" className="text-xl font-semibold">
          {t.documents.library.recentTitle}
        </h2>
        <Link className="text-sm text-primary underline-offset-4 hover:underline" href={`/${locale}/teacher/documents`}>
          {t.documents.library.allDocuments}
        </Link>
      </div>
      <ul className="divide-y divide-border border border-border bg-card" data-testid="recent-documents">
        {documents.data.items.map((d) => (
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
    </section>
  );
}
