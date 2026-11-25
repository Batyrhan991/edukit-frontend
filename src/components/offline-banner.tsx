"use client";

import { useSyncExternalStore } from "react";
import { StatePanel } from "./state-panel";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Показывает предупреждение, когда браузер теряет сеть. */
export function OfflineBanner({ title, text }: { title: string; text: string }) {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
      <StatePanel variant="offline" title={title}>
        {text}
      </StatePanel>
    </div>
  );
}
