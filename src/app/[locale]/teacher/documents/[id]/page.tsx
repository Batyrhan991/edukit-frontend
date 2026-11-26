import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DocumentEditor } from "@/components/documents/document-editor";
import { LoadingPanel, StatePanel } from "@/components/state-panel";
import { getDictionary } from "@/i18n/dictionaries";
import { getDocument } from "@/lib/api/server";

export default async function DocumentPage({ params }: PageProps<"/[locale]/teacher/documents/[id]">) {
  const { locale, t } = await getDictionary();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <Link className="text-sm text-primary underline-offset-4 hover:underline" href={`/${locale}/teacher/documents`}>
        {t.documents.back}
      </Link>
      <div className="mt-4">
        <Suspense fallback={<LoadingPanel label={t.states.loading} />}>
          <Editor params={params} />
        </Suspense>
      </div>
    </div>
  );
}

/** Документ загружается с сервера: чужой или удалённый — «не найден» (сервер отвечает 404). */
async function Editor({ params }: { params: PageProps<"/[locale]/teacher/documents/[id]">["params"] }) {
  const { id } = await params;
  const { locale, t } = await getDictionary();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return <StatePanel variant="error" title={t.documents.errors.notFound} />;
  }

  const document = await getDocument(id);
  if (!document.ok) {
    if (document.reason === "unauthorized") redirect(`/${locale}/login?next=/${locale}/teacher/documents/${id}`);
    if (document.reason === "forbidden") return <StatePanel variant="forbidden" title={t.states.forbiddenTitle}>{t.ksp.errors.forbidden}</StatePanel>;
    return <StatePanel variant="error" title={document.reason === "disabled" ? t.documents.errors.notFound : t.auth.errors.unavailable} />;
  }

  return <DocumentEditor t={t.documents} locale={locale} initial={document.data} />;
}
