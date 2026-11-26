import { FileText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DocumentRowActions } from "@/components/documents/document-row-actions";
import { LoadingPanel, StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import { intlLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { listDocuments } from "@/lib/api/server";
import { fmt, formatDateTime } from "@/lib/format";
import { LIBRARY_PAGE_SIZE, MAX_QUERY, libraryHref, parseLibraryQuery } from "@/lib/library";

type SearchParams = PageProps<"/[locale]/teacher/documents">["searchParams"];

const fieldClass =
  "h-10 w-full rounded-sm border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

export default async function DocumentsPage({ searchParams }: PageProps<"/[locale]/teacher/documents">) {
  const { locale, t } = await getDictionary();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <Link className="text-sm text-primary underline-offset-4 hover:underline" href={`/${locale}/teacher`}>
        {t.ksp.back}
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.documents.title}</h1>
          <p className="mt-2 max-w-prose text-muted-foreground">{t.documents.intro}</p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/teacher/ksp`}>{t.cabinet.kspLink}</Link>
        </Button>
      </div>
      <div className="mt-8">
        <Suspense fallback={<LoadingPanel label={t.states.loading} />}>
          <Library searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

/** Поиск и фильтр — обычная форма GET: работает и без JavaScript, адрес можно сохранить в закладки. */
async function Library({ searchParams }: { searchParams: SearchParams }) {
  const { locale, t } = await getDictionary();
  const l = t.documents.library;
  const query = parseLibraryQuery(await searchParams);
  const base = `/${locale}/teacher/documents`;
  const documents = await listDocuments({
    q: query.q || undefined,
    kind: query.kind,
    offset: (query.page - 1) * LIBRARY_PAGE_SIZE,
    limit: LIBRARY_PAGE_SIZE,
  });
  if (!documents.ok) {
    if (documents.reason === "unauthorized") redirect(`/${locale}/login?next=${base}`);
    if (documents.reason === "forbidden") return <StatePanel variant="forbidden" title={t.states.forbiddenTitle}>{t.ksp.errors.forbidden}</StatePanel>;
    return <StatePanel variant="error" title={documents.reason === "disabled" ? t.documents.errors.disabled : t.auth.errors.unavailable} />;
  }

  const { items } = documents.data;
  const total = Number(documents.data.total);
  const filtered = query.q !== "" || query.kind !== undefined;
  if (total === 0 && !filtered) {
    return <StatePanel variant="empty" title={t.documents.empty} />;
  }

  const pages = Math.max(1, Math.ceil(total / LIBRARY_PAGE_SIZE));
  const labels = {
    copy: l.copy,
    copySuffix: l.copySuffix,
    copyFailed: l.copyFailed,
    deleteFailed: l.deleteFailed,
    delete: t.documents.delete,
    deleteConfirm: t.documents.deleteConfirm,
    downloadDocx: t.documents.downloadDocx,
    downloadPdf: t.documents.downloadPdf,
    actionsFor: l.actionsFor,
  };

  return (
    <div className="space-y-4">
      <form role="search" action={base} method="get" className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <label className="grid gap-1.5 text-sm font-medium">
          {l.searchLabel}
          <input type="search" name="q" defaultValue={query.q} maxLength={MAX_QUERY} placeholder={l.searchPlaceholder} className={fieldClass} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {l.kindLabel}
          <select name="kind" defaultValue={query.kind ?? ""} className={fieldClass}>
            <option value="">{l.kindAll}</option>
            <option value="ksp">{l.kindKsp}</option>
            <option value="text">{l.kindText}</option>
          </select>
        </label>
        <div className="flex gap-2">
          <Button type="submit" size="lg" className="h-10">
            {l.find}
          </Button>
          {filtered ? (
            <Button asChild variant="secondary" size="lg" className="h-10">
              {/* Обычная ссылка (полная загрузка, как у формы): поля поиска гарантированно очищаются. */}
              <a href={base}>{l.reset}</a>
            </Button>
          ) : null}
        </div>
      </form>

      <p className="text-sm text-muted-foreground" role="status">
        {fmt(l.found, { count: String(total) })}
      </p>

      {items.length === 0 ? (
        <StatePanel variant="empty" title={l.noResults} />
      ) : (
        <ul className="divide-y divide-border border border-border bg-card" data-testid="documents">
          {items.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 px-4 py-3 sm:flex-nowrap">
              <Link href={`${base}/${d.id}`} className="flex min-w-0 flex-1 basis-56 items-center gap-3 underline-offset-4 hover:underline">
                <FileText aria-hidden className="size-5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{d.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {d.kind === "ksp" ? l.kindKsp : l.kindText} ·{" "}
                    {fmt(t.documents.updated, { date: formatDateTime(d.updatedAt, intlLocale[locale]) })}
                  </span>
                </span>
              </Link>
              <DocumentRowActions id={d.id} title={d.title} t={labels} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label={l.pagination} className="flex flex-wrap items-center justify-between gap-2">
          {query.page > 1 ? (
            <Button asChild variant="secondary">
              <Link href={libraryHref(base, { ...query, page: query.page - 1 })}>{l.prev}</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">{fmt(l.pageOf, { page: String(query.page), pages: String(pages) })}</span>
          {query.page < pages ? (
            <Button asChild variant="secondary">
              <Link href={libraryHref(base, { ...query, page: query.page + 1 })}>{l.next}</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
