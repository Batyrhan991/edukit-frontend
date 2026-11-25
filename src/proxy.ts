import { NextResponse, type NextRequest } from "next/server";
import { hasLocale, negotiateLocale } from "./i18n/config";

/**
 * Добавляет префикс языка к адресам без него: "/" → "/ru".
 * Это только маршрутизация; авторизация всегда проверяется сервером API.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split("/")[1];

  if (hasLocale(firstSegment)) return;

  const target = request.nextUrl.clone();
  target.pathname = `/${negotiateLocale(request.headers.get("accept-language"))}${pathname === "/" ? "" : pathname}`;
  const response = NextResponse.redirect(target);
  // Ответ зависит от языка браузера: кэши не должны отдавать его другим пользователям.
  response.headers.set("Vary", "Accept-Language");
  return response;
}

export const config = {
  // Не трогаем служебные пути Next.js, прокси API и статические файлы с расширением.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
