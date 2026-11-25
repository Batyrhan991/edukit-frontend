"use client";

import { ShieldCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { api, problemKey, readProblem, type AuthErrorKey, type MfaStatus } from "@/lib/api/browser";
import { fmt } from "@/lib/format";
import { Field, TextInput } from "./form-parts";
import { QrCode } from "./qr-code";

type Props = {
  t: Dictionary["security"];
  mfa: Dictionary["mfa"];
  errors: Dictionary["auth"]["errors"];
  locale: Locale;
  status: MfaStatus;
};

type Setup = { sharedKey: string; authenticatorUri: string };

/** Настройка двухэтапного входа: QR → код → резервные коды; для включённого — новые коды и отключение. */
export function SecurityPanel({ t, mfa, errors, locale, status }: Props) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true);
    setError(null);
    const response = await api("POST", "/account/mfa/setup");
    setBusy(false);
    if (response.ok) setSetup((await response.json()) as Setup);
    else setError(problemKey(await readProblem(response)));
  }

  async function regenerate() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const response = await api("POST", "/account/mfa/recovery-codes");
    setBusy(false);
    if (response.ok) {
      setCodes(((await response.json()) as { recoveryCodes: string[] }).recoveryCodes);
      return;
    }
    const problem = await readProblem(response);
    if (problem.code === "mfa.reauth_required") setNotice(t.reauth);
    else setError(problemKey(problem));
  }

  if (codes) {
    return (
      <RecoveryCodes
        t={t}
        codes={codes}
        onSaved={() => {
          setCodes(null);
          setSetup(null);
          router.replace(status.required ? `/${locale}/admin` : `/${locale}/settings/security`);
          router.refresh();
        }}
      />
    );
  }

  if (status.enabled) {
    return (
      <div className="space-y-6">
        <StatePanel variant="success" title={t.statusOn}>
          {fmt(t.codesLeft, { count: String(status.recoveryCodesLeft) })}
        </StatePanel>
        {notice ? <StatePanel variant="offline" title={notice} /> : null}
        {error ? <StatePanel variant="error" title={errors[error]} /> : null}
        <div className="space-y-2">
          <Button variant="outline" disabled={busy} onClick={regenerate}>
            {t.regenerate}
          </Button>
          <p className="text-sm text-muted-foreground">{t.regenerateHint}</p>
        </div>
        {status.required ? (
          <p className="text-sm text-muted-foreground">{t.adminCannotDisable}</p>
        ) : (
          <DisableForm t={t} mfa={mfa} errors={errors} onDone={() => router.refresh()} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {status.required ? <StatePanel variant="forbidden" title={t.requiredNotice} /> : null}
      <div className="flex items-center gap-2 text-muted-foreground">
        <ShieldOff aria-hidden className="size-5" />
        <span>{t.statusOff}</span>
      </div>
      {error ? <StatePanel variant="error" title={errors[error]} /> : null}
      {setup ? (
        <EnableForm t={t} mfa={mfa} errors={errors} setup={setup} onEnabled={setCodes} />
      ) : (
        <Button disabled={busy} onClick={begin}>
          <ShieldCheck aria-hidden />
          {t.start}
        </Button>
      )}
    </div>
  );
}

function EnableForm({
  t,
  mfa,
  errors,
  setup,
  onEnabled,
}: {
  t: Dictionary["security"];
  mfa: Dictionary["mfa"];
  errors: Dictionary["auth"]["errors"];
  setup: Setup;
  onEnabled: (codes: string[]) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await api("POST", "/account/mfa/enable", { code: code.trim() });
    setBusy(false);
    if (response.ok) onEnabled(((await response.json()) as { recoveryCodes: string[] }).recoveryCodes);
    else setError(problemKey(await readProblem(response)));
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5 border border-border bg-card p-5">
      <div className="space-y-3">
        <p className="font-medium">{t.step1}</p>
        <QrCode value={setup.authenticatorUri} label={t.step1} />
        <p className="text-sm text-muted-foreground">{t.manualKey}</p>
        <code className="block w-fit select-all bg-muted px-3 py-2 font-mono text-sm tracking-wider">{setup.sharedKey}</code>
      </div>
      <Field label={t.step2}>
        {(a) => (
          <TextInput
            {...a}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="max-w-40 font-mono tracking-widest"
          />
        )}
      </Field>
      {error ? <StatePanel variant="error" title={errors[error]} /> : null}
      <Button type="submit" disabled={busy || code.trim().length < 6}>
        {busy ? mfa.submit : t.enable}
      </Button>
    </form>
  );
}

function RecoveryCodes({ t, codes, onSaved }: { t: Dictionary["security"]; codes: string[]; onSaved: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");

  function download() {
    const url = URL.createObjectURL(new Blob([`EduKit\n\n${text}\n`], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "edukit-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <StatePanel variant="success" title={t.codesTitle}>
        {t.codesText}
      </StatePanel>
      <ol data-testid="recovery-codes" className="grid grid-cols-2 gap-2 border border-border bg-card p-4 font-mono text-sm sm:grid-cols-2">
        {codes.map((code) => (
          <li key={code} className="select-all">
            {code}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={download}>
          {t.download}
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? t.copied : t.copy}
        </Button>
        <Button onClick={onSaved}>{t.codesSaved}</Button>
      </div>
    </div>
  );
}

function DisableForm({
  t,
  mfa,
  errors,
  onDone,
}: {
  t: Dictionary["security"];
  mfa: Dictionary["mfa"];
  errors: Dictionary["auth"]["errors"];
  onDone: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await api("POST", "/account/mfa/disable", { code: code.trim() });
    setBusy(false);
    if (response.ok) onDone();
    else setError(problemKey(await readProblem(response)));
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 border-t border-border pt-6">
      <Field label={mfa.code} hint={t.disableHint}>
        {(a) => (
          <TextInput
            {...a}
            name="disableCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="max-w-40 font-mono tracking-widest"
          />
        )}
      </Field>
      {error ? <StatePanel variant="error" title={errors[error]} /> : null}
      <Button type="submit" variant="destructive" disabled={busy || code.trim().length < 6}>
        {t.disable}
      </Button>
    </form>
  );
}
