"use client";

import { Monitor } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import { intlLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { api, type Session } from "@/lib/api/browser";
import { formatDateTime } from "@/lib/format";

export function LogoutButton({ label, locale }: { label: string; locale: Locale }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api("POST", "/auth/logout");
        router.replace(`/${locale}/login`);
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}

/** Короткое описание браузера из User-Agent без внешних библиотек. */
function describe(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Firefox\//.test(userAgent) ? "Firefox" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : null;
  const os = /Windows/.test(userAgent) ? "Windows" : /Android/.test(userAgent) ? "Android" : /iPhone|iPad/.test(userAgent) ? "iOS" : /Mac OS X/.test(userAgent) ? "macOS" : /Linux/.test(userAgent) ? "Linux" : null;
  return [browser, os].filter(Boolean).join(", ") || null;
}

export function SessionsList({ t, locale, sessions }: { t: Dictionary["sessions"]; locale: Locale; sessions: Session[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  async function end(session: Session) {
    setBusyId(session.id);
    await api("DELETE", `/sessions/${session.id}`);
    setBusyId(null);
    if (session.current) {
      router.replace(`/${locale}/login`);
    } else {
      setEnded(true);
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {ended ? <StatePanel variant="success" title={t.ended} /> : null}
      <ul className="divide-y divide-border border border-border bg-card">
        {sessions.map((session) => (
          <li key={session.id} className="flex flex-wrap items-center gap-4 p-4">
            <Monitor aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {describe(session.userAgent) ?? t.unknownDevice}
                {session.current ? <span className="ml-2 bg-secondary px-2 py-0.5 text-sm text-secondary-foreground">{t.current}</span> : null}
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm text-muted-foreground">
                <dt>{t.created}</dt>
                <dd>{formatDateTime(session.createdAt, intlLocale[locale])}</dd>
                <dt>{t.lastSeen}</dt>
                <dd>{formatDateTime(session.lastSeenAt, intlLocale[locale])}</dd>
              </dl>
            </div>
            <Button variant="outline" disabled={busyId === session.id} onClick={() => end(session)}>
              {t.end}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
