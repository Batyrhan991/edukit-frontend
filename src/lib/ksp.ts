import type { Dictionary } from "@/i18n/dictionaries";

export type KspErrorKey = keyof Dictionary["ksp"]["errors"];

/** Машинный код ответа API → ключ сообщения. */
export function kspErrorKey(code: string | null | undefined, status?: number): KspErrorKey {
  switch (code) {
    case "credits.insufficient":
      return "insufficient";
    case "ai.too_many_active":
      return "tooMany";
    case "ai.idempotency_conflict":
      return "conflict";
    case "ai.provider_unavailable":
      return "provider";
    case "ai.invalid_output":
      return "invalid";
    case "ai.timeout":
      return "timeout";
    case "ai.interrupted":
      return "interrupted";
    case "ai.busy":
      return "busy";
    case "feature.disabled":
      return "disabled";
  }
  if (status === 403) return "forbidden";
  if (status === 404) return "disabled";
  if (status === 429) return "tooMany";
  return "unknown";
}
