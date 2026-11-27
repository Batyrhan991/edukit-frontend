import type { Locale } from "@/i18n/config";
import type { Schemas } from "./api/browser";

export type KtpPlan = Schemas["KtpPlan"];
export type KtpRow = Schemas["KtpPlanRow"];

/** Учебные годы, для которых на сервере есть календарь (ADR-0048). */
export const ACADEMIC_YEARS = ["2026-2027"] as const;
export const PERIODS = ["q1", "q2", "q3", "q4", "year"] as const;
export type Period = (typeof PERIODS)[number];
/** 1 — понедельник … 6 — суббота. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6] as const;
export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;

export type KtpForm = {
  subject: string;
  grade: string;
  academicYear: string;
  period: Period;
  weekdays: number[];
  notes: string;
  language: Locale;
};

/** Проверка до отправки — те же правила, что на сервере; окончательно решает сервер. */
export function validateKtpForm(form: KtpForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.subject.trim()) errors.subject = "required";
  if (!form.grade.trim()) errors.grade = "required";
  if (form.weekdays.length < 1 || form.weekdays.length > 5) errors.weekdays = "invalid";
  if (form.notes.length > 1000) errors.notes = "too_long";
  return errors;
}

/** Дата урока «03.09.2026» (дата без времени — без сдвига часового пояса). */
export function lessonDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Строки плана по четвертям, в порядке уроков. */
export function byQuarter(rows: readonly KtpRow[]): { quarter: number; rows: KtpRow[] }[] {
  const groups: { quarter: number; rows: KtpRow[] }[] = [];
  for (const row of rows) {
    const quarter = Number(row.quarter);
    const last = groups.at(-1);
    if (last && last.quarter === quarter) last.rows.push(row);
    else groups.push({ quarter, rows: [row] });
  }
  return groups;
}
