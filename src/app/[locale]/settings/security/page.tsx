import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SecurityPanel } from "@/components/auth/security-panel";
import { LoadingPanel, StatePanel } from "@/components/state-panel";
import { getDictionary } from "@/i18n/dictionaries";
import { getMfaStatus } from "@/lib/api/server";

export default async function SecurityPage() {
  const { locale, t } = await getDictionary();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link className="text-sm text-primary underline-offset-4 hover:underline" href={`/${locale}/teacher`}>
        {t.security.back}
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{t.security.title}</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">{t.security.intro}</p>
      <div className="mt-8">
        <Suspense fallback={<LoadingPanel label={t.states.loading} />}>
          <Security />
        </Suspense>
      </div>
    </div>
  );
}

/** Доступна и администратору, которому сервер разрешает только настройку двухэтапного входа. */
async function Security() {
  const { locale, t } = await getDictionary();
  const status = await getMfaStatus();
  if (!status.ok) {
    if (status.reason === "unauthorized" || status.reason === "forbidden") redirect(`/${locale}/login?next=/${locale}/settings/security`);
    return <StatePanel variant="error" title={status.reason === "disabled" ? t.auth.errors.moduleDisabled : t.auth.errors.unavailable} />;
  }
  return <SecurityPanel t={t.security} mfa={t.mfa} errors={t.auth.errors} locale={locale} status={status.data} />;
}
