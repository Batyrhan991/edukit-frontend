import { notFound } from "next/navigation";
import { locale } from "next/root-params";
import { defaultLocale, hasLocale, type Locale } from "./config";
import type ru from "../../messages/ru.json";

/** Структура словаря задаётся русским словарём; kk и en обязаны совпадать (проверяется тестом). */
export type Dictionary = typeof ru;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  kk: () => import("../../messages/kk.json").then((m) => m.default),
  ru: () => import("../../messages/ru.json").then((m) => m.default),
  en: () => import("../../messages/en.json").then((m) => m.default),
};

/** Текущая локаль из сегмента [locale]; неизвестная локаль — 404. */
export async function getLocale(): Promise<Locale> {
  const value = await locale();
  if (!hasLocale(value)) notFound();
  return value;
}

export async function getDictionary(): Promise<{ locale: Locale; t: Dictionary }> {
  const current = await getLocale();
  return { locale: current, t: await dictionaries[current]() };
}

/**
 * Для страницы 404: никогда не вызывает notFound() повторно.
 * Неизвестная локаль заменяется языком по умолчанию.
 */
export async function getDictionarySafe(): Promise<{ locale: Locale; t: Dictionary }> {
  const value = await locale();
  const current = hasLocale(value) ? value : defaultLocale;
  return { locale: current, t: await dictionaries[current]() };
}

/** Подписи КСП на всех языках: документ получает подписи на языке самого плана, а не интерфейса. */
export async function getKspLabels(): Promise<Record<Locale, Dictionary["ksp"]>> {
  const [kk, ru, en] = await Promise.all([dictionaries.kk(), dictionaries.ru(), dictionaries.en()]);
  return { kk: kk.ksp, ru: ru.ksp, en: en.ksp };
}

/** Подписи домашнего задания на всех языках: свои и общие подписи заданий (из тестов). */
export async function getHomeworkLabels(): Promise<Record<Locale, { hw: Dictionary["homework"]; quiz: Dictionary["quiz"] }>> {
  const [kk, ru, en] = await Promise.all([dictionaries.kk(), dictionaries.ru(), dictionaries.en()]);
  return { kk: { hw: kk.homework, quiz: kk.quiz }, ru: { hw: ru.homework, quiz: ru.quiz }, en: { hw: en.homework, quiz: en.quiz } };
}

/** Подписи рабочего листа на всех языках: свои и общие подписи заданий (из тестов). */
export async function getWorksheetLabels(): Promise<Record<Locale, { ws: Dictionary["worksheet"]; quiz: Dictionary["quiz"] }>> {
  const [kk, ru, en] = await Promise.all([dictionaries.kk(), dictionaries.ru(), dictionaries.en()]);
  return { kk: { ws: kk.worksheet, quiz: kk.quiz }, ru: { ws: ru.worksheet, quiz: ru.quiz }, en: { ws: en.worksheet, quiz: en.quiz } };
}

/** Подписи теста на всех языках: документы получают подписи на языке самого теста. */
export async function getQuizLabels(): Promise<Record<Locale, Dictionary["quiz"]>> {
  const [kk, ru, en] = await Promise.all([dictionaries.kk(), dictionaries.ru(), dictionaries.en()]);
  return { kk: kk.quiz, ru: ru.quiz, en: en.quiz };
}

/** Подписи КТП на всех языках: документ получает подписи на языке самого плана. */
export async function getKtpLabels(): Promise<Record<Locale, Dictionary["ktp"]>> {
  const [kk, ru, en] = await Promise.all([dictionaries.kk(), dictionaries.ru(), dictionaries.en()]);
  return { kk: kk.ktp, ru: ru.ktp, en: en.ktp };
}

/** Подписи СОР/СОЧ на всех языках: документы получают подписи на языке самой работы. */
export async function getSorLabels(): Promise<Record<Locale, Dictionary["sor"]>> {
  const [kk, ru, en] = await Promise.all([dictionaries.kk(), dictionaries.ru(), dictionaries.en()]);
  return { kk: kk.sor, ru: ru.sor, en: en.sor };
}
