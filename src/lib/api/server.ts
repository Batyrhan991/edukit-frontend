import "server-only";
import { cookies } from "next/headers";
import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

export type SystemInfo = components["schemas"]["SystemInfoResponse"];
export type Me = components["schemas"]["MeResponse"];
export type Session = components["schemas"]["SessionResponse"];

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
  | { ok: false; reason: "unreachable" | "unauthorized" | "disabled" | "error"; status?: number };

async function call<T>(request: () => Promise<{ data?: T; response: Response }>): Promise<ApiResult<T>> {
  try {
    const { data, response } = await request();
    if (data !== undefined && response.ok) return { ok: true, data };
    if (response.status === 401) return { ok: false, reason: "unauthorized", status: 401 };
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
