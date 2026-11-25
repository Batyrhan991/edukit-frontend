import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FlagToggle } from "@/components/admin/flag-toggle";
import { LoadingPanel, StatePanel } from "@/components/state-panel";
import { intlLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getAdminOverview, getAuditLog, getMfaStatus } from "@/lib/api/server";
import { formatDateTime } from "@/lib/format";

// Совпадает с FeatureKeys.LockedForApi на сервере; сервер всё равно отклонит изменение.
const lockedFlags = new Set(["identity", "admin", "billing.real-payments", "integrations.kundelik"]);

export default async function AdminPage() {
  const { t } = await getDictionary();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t.admin.title}</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">{t.admin.intro}</p>
      <div className="mt-8">
        <Suspense fallback={<LoadingPanel label={t.states.loading} />}>
          <AdminContent />
        </Suspense>
      </div>
    </div>
  );
}

async function AdminContent() {
  const { locale, t } = await getDictionary();
  const a = t.admin;
  const [overview, audit] = await Promise.all([getAdminOverview(), getAuditLog(50)]);

  if (!overview.ok) {
    if (overview.reason === "unauthorized") redirect(`/${locale}/login?next=/${locale}/admin`);
    if (overview.reason === "forbidden") {
      // Администратор без настроенного второго фактора — сразу к настройке; остальным — «нет доступа».
      const mfa = await getMfaStatus();
      if (mfa.ok && mfa.data.required && !mfa.data.enabled) redirect(`/${locale}/settings/security`);
      return <StatePanel variant="forbidden" title={t.states.forbiddenTitle}>{a.forbidden}</StatePanel>;
    }
    return <StatePanel variant="error" title={overview.reason === "disabled" ? t.auth.errors.moduleDisabled : t.auth.errors.unavailable} />;
  }

  const o = overview.data;
  const modules = t.status.modules as Record<string, string>;
  const stats = [
    [a.users, o.usersTotal],
    [a.staff, o.staff],
    [a.admins, o.platformAdmins],
    [a.withMfa, o.usersWithMfa],
  ] as const;

  return (
    <div className="space-y-12">
      <dl className="grid grid-cols-2 border-l border-t border-border sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="border-b border-r border-border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-3xl font-bold tabular-nums">{String(value)}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="modules-title">
        <h2 id="modules-title" className="text-xl font-semibold">
          {a.modules}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{a.modulesHint}</p>
        <ul className="mt-4 divide-y divide-border border border-border bg-card">
          {Object.entries(o.features).map(([key, enabled]) => (
            <li key={key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
              <span>
                {modules[key] ?? key}
                <span className="ml-2 text-sm text-muted-foreground">
                  {enabled ? t.status.enabled : t.status.disabled}
                </span>
              </span>
              {lockedFlags.has(key) ? (
                <span className="text-sm text-muted-foreground">{a.locked}</span>
              ) : (
                <FlagToggle flag={key} enabled={enabled} labels={{ on: a.turnOn, off: a.turnOff, failed: t.states.errorTitle }} />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="audit-title">
        <h2 id="audit-title" className="text-xl font-semibold">
          {a.audit}
        </h2>
        {audit.ok ? (
          <div className="mt-4 overflow-x-auto border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">{a.when}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{a.action}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{a.actor}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{a.result}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {audit.data.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-3 py-2">{formatDateTime(entry.occurredAt, intlLocale[locale])}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {entry.action}
                      {entry.targetId ? ` → ${entry.targetId}` : ""}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{entry.actorId ? entry.actorId.slice(0, 8) : a.system}</td>
                    <td className="px-3 py-2">{entry.succeeded ? a.ok : a.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <StatePanel variant="error" title={t.auth.errors.unavailable} />
        )}
      </section>
    </div>
  );
}
