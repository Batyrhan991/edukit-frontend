"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Поле формы: подпись, подсказка и ошибка связаны с полем через aria-describedby. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput(props: ComponentProps<typeof Input>) {
  return <Input {...props} className={cn("h-10 text-base", props.className)} />;
}

export function PasswordInput({
  showLabel,
  hideLabel,
  ...props
}: ComponentProps<typeof Input> & { showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <TextInput {...props} type={visible ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
      </button>
    </div>
  );
}

/** Карточка формы на «тетрадном» фоне: тот же фирменный приём, что на главной. */
export function AuthCard({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="squared-paper flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
      <section className="w-full max-w-md border border-border bg-card p-6 shadow-[6px_6px_0_0_var(--primary)] sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {intro ? <p className="mt-2 text-muted-foreground">{intro}</p> : null}
        <div className="mt-6">{children}</div>
      </section>
    </div>
  );
}
