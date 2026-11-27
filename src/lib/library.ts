/** Параметры адреса библиотеки (?q=…&kind=…&page=…) — разбор и сборка; неизвестное значение отбрасывается. */
export const LIBRARY_PAGE_SIZE = 20;
export const MAX_QUERY = 200;
export const MAX_TITLE = 200;

export type LibraryKind = "ksp" | "sor" | "ktp" | "test" | "worksheet" | "text";
export type LibraryQuery = { q: string; kind?: LibraryKind; page: number };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseLibraryQuery(params: Record<string, string | string[] | undefined>): LibraryQuery {
  const q = (first(params.q) ?? "").trim().slice(0, MAX_QUERY);
  const kindValue = first(params.kind);
  const kind = kindValue === "ksp" || kindValue === "sor" || kindValue === "ktp" || kindValue === "test" || kindValue === "worksheet" || kindValue === "text" ? kindValue : undefined;
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return { q, kind, page: Number.isFinite(page) && page >= 1 && page <= 1000 ? page : 1 };
}

export function libraryHref(base: string, query: LibraryQuery): string {
  const search = new URLSearchParams();
  if (query.q) search.set("q", query.q);
  if (query.kind) search.set("kind", query.kind);
  if (query.page > 1) search.set("page", String(query.page));
  const text = search.toString();
  return text ? `${base}?${text}` : base;
}

/** Название копии на языке интерфейса; укорачивается так, чтобы вместе с пометкой уложиться в предел сервера. */
export function copyTitle(title: string, template: string): string {
  const suffixLength = template.replace("{title}", "").length;
  const room = Math.max(1, MAX_TITLE - suffixLength);
  const base = title.length > room ? title.slice(0, room - 1).trimEnd() + "…" : title;
  return template.replace("{title}", base);
}
