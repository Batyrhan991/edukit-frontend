import { Ban, CheckCircle2, Inbox, TriangleAlert, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StateVariant = "empty" | "error" | "offline" | "success" | "forbidden";

const config: Record<StateVariant, { Icon: typeof Inbox; tone: string; role: "status" | "alert" }> = {
  empty: { Icon: Inbox, tone: "border-border", role: "status" },
  error: { Icon: TriangleAlert, tone: "border-destructive", role: "alert" },
  offline: { Icon: WifiOff, tone: "border-warning", role: "status" },
  success: { Icon: CheckCircle2, tone: "border-success", role: "status" },
  forbidden: { Icon: Ban, tone: "border-destructive", role: "alert" },
};

/**
 * Стандартное состояние экрана. Смысл передаётся текстом и иконкой, цвет — дополнительный признак (ТЗ §5).
 */
export function StatePanel({
  variant,
  title,
  children,
  action,
}: {
  variant: StateVariant;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const { Icon, tone, role } = config[variant];
  return (
    <div role={role} data-state={variant} className={cn("flex gap-3 border border-l-4 bg-card p-4", tone)}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-foreground" />
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">{title}</p>
        {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  );
}

/** Скелетон загрузки: скрыт от экранных дикторов, вместо него читается текст статуса. */
export function LoadingPanel({ label }: { label: string }) {
  return (
    <div role="status" data-state="loading" className="space-y-2 border border-border bg-card p-4">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="h-4 w-1/3 animate-pulse bg-muted" />
      <div aria-hidden className="h-3 w-2/3 animate-pulse bg-muted" />
      <div aria-hidden className="h-3 w-1/2 animate-pulse bg-muted" />
    </div>
  );
}
