import type { Locale } from "@/i18n/config";

/**
 * Куда вернуть пользователя после входа. Разрешены только внутренние пути текущего языка —
 * защита от открытого перенаправления (`?next=https://evil.example`).
 */
export function safeNext(next: string | null, locale: Locale): string {
  const fallback = `/${locale}/teacher`;
  if (!next || !next.startsWith(`/${locale}/`) || next.startsWith("//") || next.includes("\\") || next.includes("://")) {
    return fallback;
  }
  return next;
}
