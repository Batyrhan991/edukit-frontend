import type { Metadata, Viewport } from "next";
import { Noto_Sans } from "next/font/google";
import { OfflineBanner } from "@/components/offline-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { locales } from "@/i18n/config";
import { getDictionarySafe } from "@/i18n/dictionaries";
import "../globals.css";

// Казахские буквы Ә Ғ Қ Ң Ө Ұ Ү Һ І находятся в блоках cyrillic и cyrillic-ext.
const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionarySafe();
  return { title: t.meta.title, description: t.meta.description };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

// Макет не вызывает notFound(): иначе страница 404 не может отрисоваться внутри него.
// Неизвестный язык отклоняет сама страница (getDictionary), и показывается фирменная 404.
export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const { locale, t } = await getDictionarySafe();

  return (
    <html lang={locale} className={`${notoSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            {t.nav.skipToContent}
          </a>
          <SiteHeader locale={locale} t={t} />
          <OfflineBanner title={t.states.offlineTitle} text={t.states.offlineText} />
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
          <SiteFooter locale={locale} t={t} />
        </ThemeProvider>
      </body>
    </html>
  );
}
