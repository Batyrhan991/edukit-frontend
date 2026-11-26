import "server-only";
import { cookies } from "next/headers";
import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

export type SystemInfo = components["schemas"]["SystemInfoResponse"];
export type Me = components["schemas"]["MeResponse"];
export type Session = components["schemas"]["SessionResponse"];
export type MfaStatus = components["schemas"]["MfaStatusResponse"];
export type SignInMethods = components["schemas"]["SignInMethodsResponse"];
export type Credits = components["schemas"]["CreditBalanceResponse"];
export type DocumentData = components["schemas"]["DocumentResponse"];
export type DocumentListItem = components["schemas"]["DocumentListItem"];
export type DocumentPage = components["schemas"]["DocumentPage"];
export type AdminOverview = components["schemas"]["AdminOverviewResponse"];
export type AuditEntry = components["schemas"]["AuditEntryResponse"];

const SESSION_COOKIE = "edukit_session";

/**
 * Серверный клиент EduKit API. Адрес задаётся переменной EDUKIT_API_URL (см. .env.example).
 * Типы генерируются из contracts/openapi.json командой `npm run api:generate`.
 */
function apiClient(sessionToken?: string) {
  return createClient<paths>({
    baseUrl: process.env.EDUKIT_API_URL ?? "http://localhost:5080",
    headers: sessionToken ? { cookie: `${SESSION_COOKIE}=${sessionToken}` } : undefined,
  });
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "unreachable" | "unauthorized" | "forbidden" | "disabled" | "error"; status?: number };

async function call<T>(request: () => Promise<{ data?: T; response: Response }>): Promise<ApiResult<T>> {
  try {
    const { data, response } = await request();
    if (data !== undefined && response.ok) return { ok: true, data };
    if (response.status === 401) return { ok: false, reason: "unauthorized", status: 401 };
    if (response.status === 403) return { ok: false, reason: "forbidden", status: 403 };
    if (response.status === 404) return { ok: false, reason: "disabled", status: 404 };
    return { ok: false, reason: "error", status: response.status };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}

/** Cookie сессии текущего запроса (читается только на сервере; в браузере она HttpOnly). */
async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function getSystemInfo(): Promise<ApiResult<SystemInfo>> {
  return call(() => apiClient().GET("/api/v1/system/info", { signal: AbortSignal.timeout(5000) }));
}

export async function getMe(): Promise<ApiResult<Me>> {
  const token = await sessionToken();
  if (!token) return { ok: false, reason: "unauthorized", status: 401 };
  return call(() => apiClient(token).GET("/api/v1/me", { signal: AbortSignal.timeout(5000) }));
}

export async function getSessions(): Promise<ApiResult<Session[]>> {
  const token = await sessionToken();
  if (!token) return { ok: false, reason: "unauthorized", status: 401 };
  return call(() => apiClient(token).GET("/api/v1/sessions", { signal: AbortSignal.timeout(5000) }));
}

/** Включённые способы входа. При недоступном API кнопку Google не показываем. */
export async function getAuthProviders(): Promise<{ google: boolean }> {
  const result = await call(() => apiClient().GET("/api/v1/auth/providers", { signal: AbortSignal.timeout(5000) }));
  return { google: result.ok && result.data.google };
}

export async function getMfaStatus(): Promise<ApiResult<MfaStatus>> {
  const token = await sessionToken();
  if (!token) return { ok: false, reason: "unauthorized", status: 401 };
  return call(() => apiClient(token).GET("/api/v1/account/mfa", { signal: AbortSignal.timeout(5000) }));
}

export async function getSignInMethods(): Promise<ApiResult<SignInMethods>> {
  const token = await sessionToken();
  if (!token) return { ok: false, reason: "unauthorized", status: 401 };
  return call(() => apiClient(token).GET("/api/v1/account/sign-in-methods", { signal: AbortSignal.timeout(5000) }));
}

export async function getCredits(): Promise<ApiResult<Credits>> {
  const token = await sessionToken();
  if (!token) return { ok: false, reason: "unauthorized", status: 401 };
  return call(() => apiClient(token).GET("/api/v1/credits", { signal: AbortSignal.timeout(5000) }));
}

/** Личная библиотека: поиск по названию, фильтр по виду, страница (offset/limit до 100). */
export async function listDocuments(query: { q?: string; kind?: "ksp" | "text"; offset?: number; limit?: number } = {}): Promise<ApiResult<DocumentPage>> {
  const token = await sessionToken();
  if (!token) return { ok: false, reason: "unauthorized", status: 401 };
  return call(() => apiClient(token).GET("/api/v1/documents", { params: { query }, signal: AbortSignal.timeout(5000) }));
}

export async function getDocument(id: string): Promise<ApiResult<DocumentData>> {
  const token = await sessionToken();
  if (!token) return { ok: false, reason: "unauthorized", status: 401 };
  return call(() => apiClient(token).GET("/api/v1/documents/{id}", { params: { path: { id } }, signal: AbortSignal.timeout(5000) }));
}

export async function getAdminOverview(): Promise<ApiResult<AdminOverview>> {
  const token = await sessionToken();
  if (!token) return { ok: false, reason: "unauthorized", status: 401 };
  return call(() => apiClient(token).GET("/api/v1/admin/overview", { signal: AbortSignal.timeout(5000) }));
}

export async function getAuditLog(limit = 50): Promise<ApiResult<AuditEntry[]>> {
  const token = await sessionToken();
  if (!token) return { ok: false, reason: "unauthorized", status: 401 };
  return call(() => apiClient(token).GET("/api/v1/admin/audit", { params: { query: { limit } }, signal: AbortSignal.timeout(5000) }));
}
