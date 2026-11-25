import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/auth-forms";
import { AuthCard } from "@/components/auth/form-parts";
import { LoadingPanel } from "@/components/state-panel";
import { getDictionary } from "@/i18n/dictionaries";
import { getAuthProviders } from "@/lib/api/server";

export default async function Page() {
  const { t } = await getDictionary();
  return (
    <AuthCard title={t.auth.registerTitle} intro={t.auth.registerIntro}>
      {/* Форма читает параметры адреса — отрисовывается в браузере внутри Suspense. */}
      <Suspense fallback={<LoadingPanel label={t.states.loading} />}>
        <RegisterFormWithProviders />
      </Suspense>
    </AuthCard>
  );
}

/** Кнопка Google показывается, только если на сервере настроен ключ (GET /auth/providers). */
async function RegisterFormWithProviders() {
  const [{ locale, t }, providers] = await Promise.all([getDictionary(), getAuthProviders()]);
  return <RegisterForm t={t.auth} locale={locale} google={providers.google} />;
}
