import "server-only";
import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

export type SystemInfo = components["schemas"]["SystemInfoResponse"];

/**
 * Серверный клиент EduKit API. Адрес задаётся переменной EDUKIT_API_URL (см. .env.example).
 * Типы генерируются из contracts/openapi.json командой `npm run api:generate`.
 */
function apiClient() {
  return createClient<paths>({ baseUrl: process.env.EDUKIT_API_URL ?? "http://localhost:5080" });
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; reason: "unreachable" | "error"; status?: number };

export async function getSystemInfo(): Promise<ApiResult<SystemInfo>> {
  try {
    const { data, response } = await apiClient().GET("/api/v1/system/info", {
      signal: AbortSignal.timeout(5000),
    });
    if (data) return { ok: true, data };
    return { ok: false, reason: "error", status: response.status };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
