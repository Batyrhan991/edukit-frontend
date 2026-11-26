"use client";

import { Copy, FileDown, FileText, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/browser";
import { fmt } from "@/lib/format";
import { copyTitle } from "@/lib/library";

type Labels = {
  copy: string;
  copySuffix: string;
  copyFailed: string;
  deleteFailed: string;
  delete: string;
  deleteConfirm: string;
  downloadDocx: string;
  downloadPdf: string;
  actionsFor: string;
};

/**
 * Действия с документом в библиотеке: копия, скачивание сохранённой версии, удаление.
 * Права проверяет сервер (только владелец); после изменения список перечитывается с сервера.
 */
export function DocumentRowActions({ id, title, t }: { id: string; title: string; t: Labels }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    setBusy(true);
    setError(null);
    const response = await api("POST", `/documents/${id}/copy`, { title: copyTitle(title, t.copySuffix) });
    setBusy(false);
    if (response.ok) router.refresh();
    else setError(t.copyFailed);
  }

  async function remove() {
    if (!window.confirm(t.deleteConfirm)) return;
    setBusy(true);
    setError(null);
    const response = await api("DELETE", `/documents/${id}`);
    setBusy(false);
    if (response.ok || response.status === 404) router.refresh();
    else setError(t.deleteFailed);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div role="group" aria-label={fmt(t.actionsFor, { title })} className="flex flex-wrap justify-end gap-1">
        <Button variant="ghost" size="icon-lg" onClick={copy} disabled={busy} aria-label={t.copy} title={t.copy}>
          <Copy aria-hidden />
        </Button>
        <Button asChild variant="ghost" size="lg">
          <a href={`/api/v1/documents/${id}/export?format=docx`} download aria-label={t.downloadDocx} title={t.downloadDocx}>
            <FileText aria-hidden />
            Word
          </a>
        </Button>
        <Button asChild variant="ghost" size="lg">
          <a href={`/api/v1/documents/${id}/export?format=pdf`} download aria-label={t.downloadPdf} title={t.downloadPdf}>
            <FileDown aria-hidden />
            PDF
          </a>
        </Button>
        <Button variant="ghost" size="icon-lg" onClick={remove} disabled={busy} aria-label={t.delete} title={t.delete}>
          <Trash2 aria-hidden />
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
