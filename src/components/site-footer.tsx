import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export function SiteFooter({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground sm:px-6">
        <p>{t.footer.note}</p>
        <ul className="flex gap-5">
          <li>
            <Link className="hover:text-foreground" href={`/${locale}/status`}>
              {t.nav.status}
            </Link>
          </li>
          <li>
            <Link className="hover:text-foreground" href={`/${locale}/design`}>
              {t.nav.design}
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
