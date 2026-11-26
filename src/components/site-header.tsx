import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { Suspense } from "react";
import { hasSessionCookie } from "@/lib/api/server";
import { LocaleLinks, LocaleSwitcher } from "./locale-switcher";
import { ThemeSwitcher } from "./theme-switcher";

export function SiteHeader({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        {/* Текстовый логотип (ТЗ §5) */}
        <Link href={`/${locale}`} className="text-xl font-bold tracking-tight text-foreground">
          Edu<span className="text-primary">Kit</span>
        </Link>
        <nav aria-label={t.nav.main} className="order-3 w-full sm:order-none sm:w-auto">
          <ul className="flex gap-5 overflow-x-auto text-sm">
            <li>
              <Link className="text-muted-foreground hover:text-foreground" href={`/${locale}#features`}>
                {t.nav.features}
              </Link>
            </li>
            <li>
              <Link className="text-muted-foreground hover:text-foreground" href={`/${locale}#pricing`}>
                {t.nav.pricing}
              </Link>
            </li>
            <li>
              <Link className="text-muted-foreground hover:text-foreground" href={`/${locale}#faq`}>
                {t.nav.faq}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {/* Пока читается cookie — пустое место той же высоты, чтобы «Войти» не мелькало у вошедшего. */}
          <Suspense fallback={<span className="h-9 w-20" aria-hidden />}>
            <AccountLink locale={locale} t={t} />
          </Suspense>
          <Suspense fallback={<LocaleLinks current={locale} label={t.nav.language} pathname={`/${locale}`} />}>
            <LocaleSwitcher current={locale} label={t.nav.language} />
          </Suspense>
          <ThemeSwitcher
            labels={{
              theme: t.nav.theme,
              light: t.nav.themeLight,
              dark: t.nav.themeDark,
              system: t.nav.themeSystem,
            }}
          />
        </div>
      </div>
    </header>
  );
}

const accountLinkClass = "flex h-9 items-center bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90";

/** «Войти» для гостя, «Мой кабинет» после входа. Устаревшая сессия: кабинет сам отправит на вход. */
async function AccountLink({ locale, t }: { locale: Locale; t: Dictionary }) {
  const signedIn = await hasSessionCookie();
  return signedIn ? (
    <Link href={`/${locale}/teacher`} className={accountLinkClass}>
      {t.nav.cabinet}
    </Link>
  ) : (
    <Link href={`/${locale}/login`} className={accountLinkClass}>
      {t.nav.signIn}
    </Link>
  );
}
