import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SessionsList } from "@/components/auth/account-actions";
import { LoadingPanel, StatePanel } from "@/components/state-panel";
import { getDictionary } from "@/i18n/dictionaries";
import { getSessions } from "@/lib/api/server";

export default async function SessionsPage() {
  const { t } = await getDictionary();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t.sessions.title}</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">{t.sessions.intro}</p>
      <div className="mt-8">
        <Suspense fallback={<LoadingPanel label={t.states.loading} />}>
          <Sessions />
        </Suspense>
      </div>
    </div>
  );
}

async function Sessions() {
  const { locale, t } = await getDictionary();
  const result = await getSessions();
  if (!result.ok) {
    if (result.reason === "unauthorized") redirect(`/${locale}/login?next=/${locale}/settings/sessions`);
    return <StatePanel variant="error" title={result.reason === "disabled" ? t.auth.errors.moduleDisabled : t.auth.errors.unavailable} />;
  }
  return <SessionsList t={t.sessions} locale={locale} sessions={result.data} />;
}
