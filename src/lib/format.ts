/** Подстановка значений в строку словаря: fmt("Здравствуйте, {name}!", { name: "Айгерім" }). */
export function fmt(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] : match));
}

/** Дата и время в локали пользователя. Часовой пояс — браузера (до появления учреждения, ТЗ §5). */
export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
