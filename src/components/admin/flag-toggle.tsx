"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/browser";

/** Переключатель модуля. Результат определяет сервер: после ответа страница перечитывает состояние. */
export function FlagToggle({ flag, enabled, labels }: { flag: string; enabled: boolean; labels: { on: string; off: string; failed: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {failed ? (
        <span role="alert" className="text-sm text-destructive">
          {labels.failed}
        </span>
      ) : null}
      <Button
        size="sm"
        variant={enabled ? "outline" : "default"}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          const response = await api("PUT", `/admin/feature-flags/${encodeURIComponent(flag)}`, { enabled: !enabled });
          setBusy(false);
          if (response.ok) router.refresh();
          else setFailed(true);
        }}
      >
        {enabled ? labels.off : labels.on}
      </Button>
    </div>
  );
}
