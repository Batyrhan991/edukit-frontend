import Link from "next/link";
import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import { getDictionarySafe } from "@/i18n/dictionaries";

export default async function NotFound() {
  const { locale, t } = await getDictionarySafe();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <p className="mb-4 text-6xl font-bold text-primary tabular-nums">404</p>
      <StatePanel
        variant="empty"
        title={t.notFound.title}
        action={
          <Button asChild>
            <Link href={`/${locale}`}>{t.states.home}</Link>
          </Button>
        }
      >
        {t.notFound.text}
      </StatePanel>
    </div>
  );
}
