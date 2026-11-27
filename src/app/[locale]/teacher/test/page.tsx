import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { QuizGenerator } from "@/components/generators/quiz-generator";
import { LoadingPanel, StatePanel } from "@/components/state-panel";
import { getDictionary, getQuizLabels } from "@/i18n/dictionaries";
import { getCredits } from "@/lib/api/server";

export default async function TestPage() {
  const { locale, t } = await getDictionary();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <Link className="text-sm text-primary underline-offset-4 hover:underline" href={`/${locale}/teacher`}>
        {t.quiz.back}
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{t.quiz.title}</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">{t.quiz.intro}</p>
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
  const [credits, labels] = await Promise.all([getCredits(), getQuizLabels()]);
  if (!credits.ok) {
    if (credits.reason === "unauthorized") redirect(`/${locale}/login?next=/${locale}/teacher/test`);
    if (credits.reason === "forbidden") return <StatePanel variant="forbidden" title={t.states.forbiddenTitle}>{t.quiz.errors.forbidden}</StatePanel>;
    return <StatePanel variant="error" title={credits.reason === "disabled" ? t.quiz.errors.disabled : t.auth.errors.unavailable} />;
  }

  return <QuizGenerator t={t.quiz} locale={locale} initialCredits={credits.data} docLabels={labels} />;
}
