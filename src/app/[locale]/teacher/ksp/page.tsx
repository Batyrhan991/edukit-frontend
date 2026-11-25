import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { KspGenerator } from "@/components/generators/ksp-generator";
import { LoadingPanel, StatePanel } from "@/components/state-panel";
import { getDictionary } from "@/i18n/dictionaries";
import { getCredits } from "@/lib/api/server";

export default async function KspPage() {
  const { locale, t } = await getDictionary();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <Link className="text-sm text-primary underline-offset-4 hover:underline" href={`/${locale}/teacher`}>
        {t.ksp.back}
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{t.ksp.title}</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">{t.ksp.intro}</p>
      <div className="mt-8">
        <Suspense fallback={<LoadingPanel label={t.states.loading} />}>
          <Generator />
        </Suspense>
      </div>
    </div>
  );
}

/** Права проверяет API: без сессии — на вход; ученик — 403; модуль выключен — 404. */
async function Generator() {
  const { locale, t } = await getDictionary();
  const credits = await getCredits();
  if (!credits.ok) {
    if (credits.reason === "unauthorized") redirect(`/${locale}/login?next=/${locale}/teacher/ksp`);
    if (credits.reason === "forbidden") return <StatePanel variant="forbidden" title={t.states.forbiddenTitle}>{t.ksp.errors.forbidden}</StatePanel>;
    return <StatePanel variant="error" title={credits.reason === "disabled" ? t.ksp.errors.disabled : t.auth.errors.unavailable} />;
  }

  return <KspGenerator t={t.ksp} locale={locale} initialCredits={credits.data} />;
}
