import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { AuthCard } from "@/components/auth/form-parts";
import { LoadingPanel } from "@/components/state-panel";
import { getDictionary } from "@/i18n/dictionaries";

export default async function Page() {
  const { locale, t } = await getDictionary();
  return (
    <AuthCard title={t.auth.resetTitle}>
      {/* Форма читает параметры адреса — отрисовывается в браузере внутри Suspense. */}
      <Suspense fallback={<LoadingPanel label={t.states.loading} />}>
        <ResetPasswordForm t={t.auth} locale={locale} />
      </Suspense>
    </AuthCard>
  );
}
