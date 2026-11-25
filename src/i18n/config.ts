export const locales = ["kk", "ru", "en"] as const;

export type Locale = (typeof locales)[number];

/**
 * Язык по умолчанию, если браузер не прислал поддерживаемый язык.
 * Открытый вопрос (см. docs/DECISIONS.md, ADR-0004): kk или ru.
 */
export const defaultLocale: Locale = "ru";

/** Локаль Intl для форматирования дат, чисел и KZT. */
export const intlLocale: Record<Locale, string> = {
  kk: "kk-KZ",
  ru: "ru-KZ",
  en: "en-KZ",
};

export function hasLocale(value: string | undefined | null): value is Locale {
  return value != null && (locales as readonly string[]).includes(value);
}

/**
 * Выбор языка по заголовку Accept-Language (RFC 9110): учитываем q-веса и базовый язык (ru-RU → ru).
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale;

  const candidates = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return { base: tag.trim().toLowerCase().split("-")[0], q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((c) => c.base && c.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  return candidates.find((c) => hasLocale(c.base))?.base as Locale | undefined ?? defaultLocale;
}

export function formatKzt(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale[locale], {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(amount);
}
