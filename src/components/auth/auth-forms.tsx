"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoadingPanel, StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { api, fieldErrors, problemKey, readProblem, type AuthErrorKey } from "@/lib/api/browser";
import { fmt } from "@/lib/format";
import { safeNext } from "@/lib/navigation";
import { Field, PasswordInput, TextInput } from "./form-parts";

type T = Dictionary["auth"];
type Props = { t: T; locale: Locale };

const fieldMessage = (t: T, code: string | undefined) =>
  code ? ((t.errors as Record<string, string>)[code] ?? t.errors.unknown) : undefined;


function FormError({ t, error }: { t: T; error: AuthErrorKey | null }) {
  if (!error) return null;
  return (
    <StatePanel variant="error" title={t.errors[error]} />
  );
}

function ResendConfirmation({ t, email }: { t: T; email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  return state === "done" ? (
    <p role="status" className="text-sm text-muted-foreground">
      {t.resendDone}
    </p>
  ) : (
    <Button
      type="button"
      variant="outline"
      disabled={state === "sending" || !email}
      onClick={async () => {
        setState("sending");
        await api("POST", "/auth/verify-email/resend", { email });
        setState("done");
      }}
    >
      {t.resend}
    </Button>
  );
}

export function LoginForm({ t, locale }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (!login.trim()) local.login = "required";
    if (!password) local.password = "required";
    setErrors(local);
    setError(null);
    if (Object.keys(local).length > 0) return;

    setBusy(true);
    const response = await api("POST", "/auth/login", { login: login.trim(), password, rememberMe: remember });
    if (response.ok) {
      router.replace(safeNext(params.get("next"), locale));
      router.refresh();
      return;
    }
    const problem = await readProblem(response);
    setErrors(fieldErrors(problem));
    setError(problemKey(problem));
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label={t.loginField} error={fieldMessage(t, errors.login)}>
        {(a) => <TextInput {...a} name="login" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} />}
      </Field>
      <Field label={t.password} error={fieldMessage(t, errors.password)}>
        {(a) => (
          <PasswordInput
            {...a}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
          />
        )}
      </Field>
      <div className="flex items-start gap-2">
        <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} className="mt-0.5" />
        <div>
          <Label htmlFor="remember">{t.rememberMe}</Label>
          <p className="text-sm text-muted-foreground">{t.rememberMeHint}</p>
        </div>
      </div>
      <FormError t={t} error={error} />
      {error === "emailNotConfirmed" ? <ResendConfirmation t={t} email={login.includes("@") ? login.trim() : ""} /> : null}
      <Button type="submit" className="h-10 w-full" disabled={busy}>
        {busy ? t.submitting : t.loginSubmit}
      </Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link className="text-primary underline-offset-4 hover:underline" href={`/${locale}/forgot-password`}>
          {t.forgotLink}
        </Link>
        <span>
          {t.noAccount}{" "}
          <Link className="text-primary underline-offset-4 hover:underline" href={`/${locale}/register`}>
            {t.registerLink}
          </Link>
        </span>
      </div>
    </form>
  );
}

export function RegisterForm({ t, locale }: Props) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (!form.firstName.trim()) local.firstName = "required";
    if (!form.lastName.trim()) local.lastName = "required";
    if (!form.email.trim()) local.email = "required";
    if (form.password.length < 10) local.password = form.password ? "too_short" : "required";
    setErrors(local);
    setError(null);
    if (Object.keys(local).length > 0) return;

    setBusy(true);
    const response = await api("POST", "/auth/register", { ...form, email: form.email.trim(), locale });
    setBusy(false);
    if (response.status === 202) {
      setSentTo(form.email.trim());
      return;
    }
    const problem = await readProblem(response);
    setErrors(fieldErrors(problem));
    setError(problem.errors ? null : problemKey(problem));
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        <StatePanel variant="success" title={t.checkEmailTitle}>
          {fmt(t.checkEmailText, { email: sentTo })}
        </StatePanel>
        <ResendConfirmation t={t} email={sentTo} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.firstName} error={fieldMessage(t, errors.firstName)}>
          {(a) => <TextInput {...a} name="firstName" autoComplete="given-name" value={form.firstName} onChange={set("firstName")} />}
        </Field>
        <Field label={t.lastName} error={fieldMessage(t, errors.lastName)}>
          {(a) => <TextInput {...a} name="lastName" autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />}
        </Field>
      </div>
      <Field label={t.email} error={fieldMessage(t, errors.email)}>
        {(a) => <TextInput {...a} name="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} />}
      </Field>
      <Field label={t.password} hint={t.passwordHint} error={fieldMessage(t, errors.password)}>
        {(a) => (
          <PasswordInput
            {...a}
            name="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
          />
        )}
      </Field>
      <FormError t={t} error={error} />
      <Button type="submit" className="h-10 w-full" disabled={busy}>
        {busy ? t.submitting : t.registerSubmit}
      </Button>
      <p className="text-sm">
        {t.haveAccount}{" "}
        <Link className="text-primary underline-offset-4 hover:underline" href={`/${locale}/login`}>
          {t.loginLink}
        </Link>
      </p>
    </form>
  );
}

export function VerifyEmail({ t, locale }: Props) {
  const params = useSearchParams();
  const [state, setState] = useState<"working" | "ok" | "failed">("working");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const userId = params.get("uid");
    const token = params.get("token");
    if (!userId || !token) {
      queueMicrotask(() => setState("failed"));
      return;
    }
    api("POST", "/auth/verify-email", { userId, token }).then((r) => setState(r.ok ? "ok" : "failed"));
  }, [params]);

  if (state === "working") return <LoadingPanel label={t.verifying} />;
  if (state === "ok") {
    return (
      <StatePanel
        variant="success"
        title={t.verifiedTitle}
        action={
          <Button asChild>
            <Link href={`/${locale}/login`}>{t.loginLink}</Link>
          </Button>
        }
      >
        {t.verifiedText}
      </StatePanel>
    );
  }
  return <VerifyFailed t={t} />;
}

function VerifyFailed({ t }: { t: T }) {
  const [email, setEmail] = useState("");
  return (
    <div className="space-y-4">
      <StatePanel variant="error" title={t.verifyFailedTitle}>
        {t.verifyFailedText}
      </StatePanel>
      <Field label={t.email}>
        {(a) => <TextInput {...a} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <ResendConfirmation t={t} email={email.trim()} />
    </div>
  );
}

export function ForgotPasswordForm({ t, locale }: Props) {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim()) {
      setFieldError("required");
      return;
    }
    setBusy(true);
    const response = await api("POST", "/auth/password-reset/request", { email: email.trim(), locale });
    setBusy(false);
    if (response.status === 202) {
      setDone(true);
      return;
    }
    const problem = await readProblem(response);
    setFieldError(fieldErrors(problem).email);
    setError(problem.errors ? null : problemKey(problem));
  }

  if (done) {
    return (
      <StatePanel variant="success" title={t.forgotDoneTitle}>
        {t.forgotDoneText}
      </StatePanel>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label={t.email} error={fieldMessage(t, fieldError)}>
        {(a) => <TextInput {...a} name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <FormError t={t} error={error} />
      <Button type="submit" className="h-10 w-full" disabled={busy}>
        {busy ? t.submitting : t.forgotSubmit}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ t, locale }: Props) {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 10) {
      setFieldError(password ? "too_short" : "required");
      return;
    }
    setFieldError(undefined);
    const userId = params.get("uid");
    const token = params.get("token");
    if (!userId || !token) {
      setError("invalidToken");
      return;
    }
    setBusy(true);
    const response = await api("POST", "/auth/password-reset/confirm", { userId, token, newPassword: password });
    setBusy(false);
    if (response.status === 204) {
      setDone(true);
      return;
    }
    const problem = await readProblem(response);
    setFieldError(fieldErrors(problem).newPassword);
    setError(problem.errors ? null : problemKey(problem));
  }

  if (done) {
    return (
      <StatePanel
        variant="success"
        title={t.resetDoneTitle}
        action={
          <Button asChild>
            <Link href={`/${locale}/login`}>{t.loginLink}</Link>
          </Button>
        }
      >
        {t.resetDoneText}
      </StatePanel>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label={t.newPassword} hint={t.passwordHint} error={fieldMessage(t, fieldError)}>
        {(a) => (
          <PasswordInput
            {...a}
            name="newPassword"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
          />
        )}
      </Field>
      <FormError t={t} error={error} />
      {error === "invalidToken" ? (
        <Link className="text-sm text-primary underline-offset-4 hover:underline" href={`/${locale}/forgot-password`}>
          {t.forgotLink}
        </Link>
      ) : null}
      <Button type="submit" className="h-10 w-full" disabled={busy}>
        {busy ? t.submitting : t.resetSubmit}
      </Button>
    </form>
  );
}
