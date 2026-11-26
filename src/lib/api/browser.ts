import type { components } from "./schema";

export type Schemas = components["schemas"];
export type Me = Schemas["MeResponse"];
export type Session = Schemas["SessionResponse"];
export type LoginResponse = Schemas["LoginResponse"];
export type MfaStatus = Schemas["MfaStatusResponse"];
export type SignInMethods = Schemas["SignInMethodsResponse"];
export type KspDocument = Schemas["KspDocument"];
export type Generation = Schemas["GenerationResponse"];
export type Credits = Schemas["CreditBalanceResponse"];
export type DocumentData = Schemas["DocumentResponse"];

/** Ответ API в браузере: либо данные, либо разобранная ошибка. */
export type ApiProblem = { status: number; code?: string; errors?: Record<string, string[]> };

export type AuthErrorKey =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "invalidToken"
  | "invalidCode"
  | "rateLimited"
  | "unavailable"
  | "moduleDisabled"
  | "googleFailed"
  | "googleCancelled"
  | "googleEmailUnverified"
  | "googleConflict"
  | "googleBlocked"
  | "googleLinkRequired"
  | "unknown";

const googleErrors: Record<string, AuthErrorKey> = {
  google_failed: "googleFailed",
  google_cancelled: "googleCancelled",
  google_email_unverified: "googleEmailUnverified",
  google_conflict: "googleConflict",
  google_blocked: "googleBlocked",
  google_link_required: "googleLinkRequired",
};

/** Причина неудачного входа через Google из адреса `/login?error=…` (ставит сервер). Неизвестное значение игнорируется. */
export function googleErrorKey(value: string | null): AuthErrorKey | null {
  return value && Object.hasOwn(googleErrors, value) ? googleErrors[value] : null;
}

/** Запрос к API через same-origin прокси сайта. Изменяющие запросы несут CSRF-заголовок (ADR-0016). */
export async function api(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json", ...extraHeaders };
  if (method !== "GET") headers["X-EduKit-Csrf"] = "1";
  if (body !== undefined) headers["content-type"] = "application/json";

  try {
    return await fetch(`/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    // Нет сети или сайт недоступен.
    return Response.json({ code: "api.unreachable" }, { status: 503 });
  }
}

export async function readProblem(response: Response): Promise<ApiProblem> {
  try {
    const json = (await response.json()) as { code?: unknown; errors?: unknown };
    return {
      status: response.status,
      code: typeof json.code === "string" ? json.code : undefined,
      errors: json.errors && typeof json.errors === "object" ? (json.errors as Record<string, string[]>) : undefined,
    };
  } catch {
    return { status: response.status };
  }
}

/** Общая (не привязанная к полю) ошибка для показа пользователю. */
export function problemKey(problem: ApiProblem): AuthErrorKey {
  switch (problem.code) {
    case "auth.invalid_credentials":
      return "invalidCredentials";
    case "auth.email_not_confirmed":
      return "emailNotConfirmed";
    case "auth.invalid_token":
      return "invalidToken";
    case "auth.invalid_code":
      return "invalidCode";
    case "feature.disabled":
      return "moduleDisabled";
    case "api.unreachable":
      return "unavailable";
  }
  if (problem.status === 429) return "rateLimited";
  if (problem.status === 502 || problem.status === 503 || problem.status === 504) return "unavailable";
  return "unknown";
}

/** Ошибки полей: первый код для каждого поля (required, invalid_email, too_short…). */
export function fieldErrors(problem: ApiProblem): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [field, codes] of Object.entries(problem.errors ?? {})) {
    if (codes.length > 0) result[field] = codes[0];
  }
  return result;
}
