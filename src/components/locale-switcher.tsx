"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const names: Record<Locale, string> = { kk: "Қазақша", ru: "Русский", en: "English" };
const short: Record<Locale, string> = { kk: "Қаз", ru: "Рус", en: "Eng" };

/** Смена языка с сохранением текущей страницы. */
export function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  return <LocaleLinks current={current} label={label} pathname={usePathname() ?? `/${current}`} />;
}

/**
 * Ссылки на языки для заданного адреса. Без адреса (пока страница с переменной частью адреса загружается
 * внутри Suspense) ведут на главные страницы языков.
 */
export function LocaleLinks({ current, label, pathname }: { current: Locale; label: string; pathname: string }) {
  const rest = pathname.split("/").slice(2).join("/");

  return (
    <nav aria-label={label} className="flex border border-border">
      {locales.map((locale) => (
        <Link
          key={locale}
          href={`/${locale}${rest ? `/${rest}` : ""}`}
          hrefLang={locale}
          lang={locale}
          aria-current={locale === current ? "true" : undefined}
          title={names[locale]}
          className={cn(
            "flex h-9 min-w-11 items-center justify-center px-2 text-sm text-muted-foreground hover:text-foreground",
            locale === current && "bg-secondary font-semibold text-secondary-foreground",
          )}
        >
          <span aria-hidden>{short[locale]}</span>
          <span className="sr-only">{names[locale]}</span>
        </Link>
      ))}
    </nav>
  );
}
