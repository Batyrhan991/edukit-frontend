import { Suspense } from "react";
import { LoginForm } from "@/components/auth/auth-forms";
import { AuthCard } from "@/components/auth/form-parts";
import { LoadingPanel } from "@/components/state-panel";
import { getDictionary } from "@/i18n/dictionaries";
import { getAuthProviders } from "@/lib/api/server";

export default async function Page() {
  const { t } = await getDictionary();
  return (
    <AuthCard title={t.auth.loginTitle}>
      {/* Форма читает параметры адреса — отрисовывается в браузере внутри Suspense. */}
      <Suspense fallback={<LoadingPanel label={t.states.loading} />}>
        <LoginFormWithProviders />
      </Suspense>
    </AuthCard>
  );
}

/** Кнопка Google показывается, только если на сервере настроен ключ (GET /auth/providers). */
async function LoginFormWithProviders() {
  const [{ locale, t }, providers] = await Promise.all([getDictionary(), getAuthProviders()]);
  return <LoginForm t={t.auth} mfa={t.mfa} locale={locale} google={providers.google} />;
}
