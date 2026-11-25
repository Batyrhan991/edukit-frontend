"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { api, readProblem, type SignInMethods } from "@/lib/api/browser";
import { GoogleLogo } from "./google-logo";

type T = Dictionary["security"];

/** Результат возврата с Google при подключении (`/settings/security?google=…`, ставит сервер). */
function returnNotice(t: T, value: string | null): { variant: "success" | "error"; text: string } | null {
  switch (value) {
    case "linked":
      return { variant: "success", text: t.googleLinked };
    case "google_already_linked":
      return { variant: "error", text: t.googleAlreadyLinked };
    case "google_used_elsewhere":
      return { variant: "error", text: t.googleUsedElsewhere };
    case "google_cancelled":
      return { variant: "error", text: t.googleLinkCancelled };
    case "google_failed":
      return { variant: "error", text: t.googleLinkFailed };
    default:
      return null;
  }
}

/**
 * Подключение и отключение входа через Google (ADR-0032). Подключение — переход браузера на сервер и страницу Google;
 * права проверяет сервер (нужна завершённая сессия этого же браузера).
 */
export function GoogleConnection({ t, locale, methods }: { t: T; locale: Locale; methods: SignInMethods }) {
  const router = useRouter();
  const params = useSearchParams();
  const [notice, setNotice] = useState(() => returnNotice(t, params.get("google")));
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    setBusy(true);
    const response = await api("DELETE", "/account/google");
    setBusy(false);
    if (response.ok) {
      setNotice({ variant: "success", text: t.googleUnlinked });
      router.refresh();
      return;
    }
    const problem = await readProblem(response);
    setNotice({ variant: "error", text: problem.code === "account.google_last_sign_in_method" ? t.googleNeedsPassword : t.googleLinkFailed });
  }

  return (
    <section aria-labelledby="google-title" className="space-y-4 border-t border-border pt-8">
      <div>
        <h2 id="google-title" className="text-xl font-semibold">
          {t.googleTitle}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{t.googleIntro}</p>
      </div>
      <p className="flex items-center gap-2">
        <GoogleLogo />
        <span>{methods.google ? t.googleOn : t.googleOff}</span>
      </p>
      {notice ? <StatePanel variant={notice.variant} title={notice.text} /> : null}
      {methods.google ? (
        <div className="space-y-2">
          <Button variant="outline" disabled={busy} onClick={disconnect}>
            {t.googleDisconnect}
          </Button>
          {!methods.password ? <p className="text-sm text-muted-foreground">{t.googleNeedsPassword}</p> : null}
        </div>
      ) : methods.googleAvailable ? (
        <Button asChild variant="outline">
          <a href={`/api/v1/account/google/link?${new URLSearchParams({ locale }).toString()}`}>
            <GoogleLogo />
            {t.googleConnect}
          </a>
        </Button>
      ) : null}
    </section>
  );
}
