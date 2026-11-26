import type { Locale } from "@/i18n/config";

export type Mode = "sor" | "soch";
export type SorForm = {
  mode: Mode;
  subject: string;
  grade: string;
  section: string;
  quarter: string;
  duration: string;
  totalPoints: string;
  taskCount: string;
  notes: string;
  language: Locale;
};

/** Пустое поле — null, иначе число (проверка диапазонов — в validateSorForm). */
export const int = (value: string) => (value.trim() === "" ? null : Number(value));

/** Проверка до отправки — те же правила, что на сервере (ADR-0043); окончательно решает сервер. */
export function validateSorForm(form: SorForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.subject.trim()) errors.subject = "required";
  if (!form.grade.trim()) errors.grade = "required";
  if (!form.section.trim()) errors.section = "required";
  const quarter = int(form.quarter);
  if (form.mode === "soch" && quarter === null) errors.quarter = "required";
  const duration = int(form.duration);
  if (duration === null || !Number.isInteger(duration) || duration < 10 || duration > 90) errors.durationMinutes = "out_of_range";
  const total = int(form.totalPoints);
  if (total === null || !Number.isInteger(total) || total < 5 || total > 40) errors.totalPoints = "out_of_range";
  const count = int(form.taskCount);
  if (count !== null && (!Number.isInteger(count) || count < 1 || count > 15 || (total !== null && count > total))) errors.taskCount = "out_of_range";
  return errors;
}
