import type { NextRequest } from "next/server";

/**
 * Same-origin прокси к EduKit API (ADR-0016): браузер обращается только к адресу сайта, поэтому
 * cookie сессии остаётся first-party, а API не открывает CORS. Прокси не проверяет права — это делает API.
 */

const API_URL = process.env.EDUKIT_API_URL ?? "http://localhost:5080";
const MAX_BODY_BYTES = 1_000_000;
const TIMEOUT_MS = 15_000;

const forwardedRequestHeaders = ["accept", "accept-language", "content-type", "cookie", "user-agent", "x-correlation-id", "x-edukit-csrf"];
const forwardedResponseHeaders = ["content-type", "x-correlation-id", "retry-after"];

function problem(status: number, code: string, title: string) {
  return Response.json({ status, title, code }, { status, headers: { "content-type": "application/problem+json" } });
}

async function forward(request: NextRequest, ctx: RouteContext<"/api/v1/[...path]">) {
  const { path } = await ctx.params;
  if (path.some((segment) => segment === ".." || segment === "." || segment.length === 0)) {
    return problem(400, "proxy.invalid_path", "Invalid path.");
  }

  const target = new URL(`/api/v1/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`, API_URL);

  const headers = new Headers();
  for (const name of forwardedRequestHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Адрес клиента для лимита частоты в API (ADR-0025). Заголовку от клиента верить нельзя — его можно подделать,
  // поэтому передаём его только когда сайт стоит за своим балансировщиком, который этот заголовок перезаписывает.
  if (process.env.EDUKIT_TRUST_UPSTREAM_PROXY === "true") {
    const clientIp = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
    if (clientIp) headers.set("x-forwarded-for", clientIp);
  }

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) {
      return problem(413, "proxy.body_too_large", "Request body is too large.");
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return problem(502, "api.unreachable", "EduKit API is unreachable.");
  }

  const responseHeaders = new Headers();
  for (const name of forwardedResponseHeaders) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", cookie);
  }
  responseHeaders.set("cache-control", "no-store");

  const hasBody = upstream.status !== 204 && upstream.status !== 304;
  return new Response(hasBody ? upstream.body : null, { status: upstream.status, headers: responseHeaders });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
