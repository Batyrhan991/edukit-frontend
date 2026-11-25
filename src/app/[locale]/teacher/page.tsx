import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/account-actions";
import { LoadingPanel, StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { getMe } from "@/lib/api/server";
import { fmt } from "@/lib/format";

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
          <Button asChild>
            <Link href={`/${locale}/teacher/ksp`}>{t.cabinet.kspLink}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
