import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const live = !!process.env.E2E_API_URL;
const mailpit = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";
// Папка backend для служебной команды promote-admin (как это делает владелец на сервере).
const backendDir = process.env.E2E_BACKEND_DIR;
const password = "e2e long passphrase";

/** TOTP по RFC 6238 — так считает приложение-аутентификатор. */
function totp(base32: string, offsetSteps = 0): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = base32.replace(/\s/g, "").toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const c of clean) {
    buffer = (buffer << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offsetSteps));
  const hash = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = ((hash[offset] & 0x7f) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

async function linkFromMail(email: string, path: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = await (await fetch(`${mailpit}/api/v1/messages?limit=100`)).json();
    const message = list.messages.find((m: { To: { Address: string }[] }) => m.To[0].Address === email);
    if (message) {
      const full = await (await fetch(`${mailpit}/api/v1/message/${message.ID}`)).json();
      const match = (full.Text as string).match(new RegExp(`https?://\\S+/${path}\\?\\S+`));
      if (match) return match[0];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No ${path} email for ${email}`);
}

async function registerConfirmed(page: Page, email: string) {
  await page.goto("/ru/register");
  await page.getByLabel("Имя", { exact: true }).fill("Тест");
  await page.getByLabel("Фамилия").fill("Защита");
  await page.getByLabel("Электронная почта").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(page.getByText("Проверьте почту")).toBeVisible();
  const link = new URL(await linkFromMail(email, "verify-email"));
  await page.goto(link.pathname + link.search);
  await expect(page.getByText("Почта подтверждена")).toBeVisible();
}

async function passwordStep(page: Page, email: string) {
  await page.goto("/ru/login");
  await page.getByLabel("Почта или логин").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти" }).last().click();
}

/** Включает двухэтапный вход на странице «Безопасность»; возвращает ключ и резервные коды. */
async function enableMfa(page: Page): Promise<{ key: string; codes: string[] }> {
  await page.getByRole("button", { name: "Настроить двухэтапный вход" }).click();
  await expect(page.getByRole("img", { name: /Отсканируйте QR-код/ })).toBeVisible();
  const key = (await page.locator("code").first().innerText()).trim();
  await page.getByLabel(/Введите 6-значный код/).fill(totp(key));
  await page.getByRole("button", { name: "Включить" }).click();
  await expect(page.getByText("Сохраните резервные коды")).toBeVisible();
  const codes = (await page.getByTestId("recovery-codes").locator("li").allInnerTexts()).map((c) => c.trim());
  expect(codes).toHaveLength(10);
  return { key, codes };
}

test.describe("two-step sign-in (live)", () => {
  test.skip(!live, "Set E2E_API_URL to a running backend with Mailpit");
  test.describe.configure({ mode: "serial" });

  test("teacher turns on two-step sign-in and then signs in with an app code and a recovery code", async ({ page }) => {
    const email = `e2e-mfa-${Date.now()}-${test.info().project.name}@school.test`;
    await registerConfirmed(page, email);
    await passwordStep(page, email);
    await expect(page).toHaveURL(/\/ru\/teacher$/);

    await page.getByRole("link", { name: "Безопасность" }).click();
    const { key, codes } = await enableMfa(page);
    await page.getByRole("button", { name: "Я сохранил коды" }).click();
    await expect(page.getByText("Двухэтапный вход включён")).toBeVisible();

    await page.goto("/ru/teacher");
    await page.getByRole("button", { name: "Выйти" }).click();

    // Вход с кодом из приложения (следующий шаг времени — чтобы не совпасть с кодом, использованным при включении).
    await passwordStep(page, email);
    await expect(page.getByText("Подтверждение входа")).toBeVisible();
    await page.getByLabel("Код из приложения").fill("000000" === totp(key) ? "111111" : "000000");
    await page.getByRole("button", { name: "Подтвердить" }).click();
    await expect(page.locator("[data-state=error]")).toContainText("Код не подошёл");
    await page.getByLabel("Код из приложения").fill(totp(key));
    await page.getByRole("button", { name: "Подтвердить" }).click();
    await expect(page).toHaveURL(/\/ru\/teacher$/);
    await page.getByRole("button", { name: "Выйти" }).click();

    // Вход с резервным кодом.
    await passwordStep(page, email);
    await page.getByRole("button", { name: /Ввести резервный код/ }).click();
    await page.getByLabel("Резервный код").fill(codes[0]);
    await page.getByRole("button", { name: "Подтвердить" }).click();
    await expect(page).toHaveURL(/\/ru\/teacher$/);
  });

  test("admin must set up two-step sign-in before reaching administration", async ({ page }) => {
    test.skip(!backendDir, "Set E2E_BACKEND_DIR to run the promote-admin server command");
    const email = `e2e-admin-${Date.now()}-${test.info().project.name}@school.test`;
    await registerConfirmed(page, email);
    execFileSync("dotnet", ["run", "--project", "src/EduKit.Api", "--no-build", "--launch-profile", "http", "--", "promote-admin", email], {
      cwd: backendDir,
      stdio: "pipe",
    });

    await passwordStep(page, email);
    await expect(page).toHaveURL(/\/ru\/settings\/security$/);
    await expect(page.getByText("Для администратора двухэтапный вход обязателен")).toBeVisible();

    // До настройки админ-раздел недоступен: сервер отвечает 403, страница ведёт к настройке.
    await page.goto("/ru/admin");
    await expect(page).toHaveURL(/\/ru\/settings\/security$/);
    await expect(page.getByRole("heading", { name: "Администрирование" })).toHaveCount(0);

    await page.goto("/ru/settings/security");
    await enableMfa(page);
    await page.getByRole("button", { name: "Я сохранил коды" }).click();
    await expect(page).toHaveURL(/\/ru\/admin$/);
    await expect(page.getByRole("heading", { name: "Администрирование" })).toBeVisible();

    const games = page.getByRole("listitem").filter({ hasText: "Игры" });
    await games.getByRole("button", { name: "Включить" }).click();
    await expect(games).toContainText("Включён");
    await games.getByRole("button", { name: "Выключить" }).click();
    await expect(games).toContainText("Выключен");
    await expect(page.getByRole("listitem").filter({ hasText: "Реальные платежи" })).toContainText("Только на сервере");
    await expect(page.getByRole("table")).toContainText("admin.feature_flag.changed");
  });
});
