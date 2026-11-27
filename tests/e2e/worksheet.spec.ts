import { expect, test, type Page } from "@playwright/test";

const live = !!process.env.E2E_API_URL;
const mailpit = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";
const password = "e2e long passphrase";

async function verifyLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = await (await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=20`)).json();
    const message = list.messages.find((m: { To: { Address: string }[] }) => m.To[0].Address === email);
    if (message) {
      const full = await (await fetch(`${mailpit}/api/v1/message/${message.ID}`)).json();
      const match = (full.Text as string).match(/https?:\/\/\S+\/verify-email\?\S+/);
      if (match) return match[0];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No verify-email message for ${email}`);
}

async function signedInTeacher(page: Page) {
  const email = `e2e-ws-${Date.now()}-${test.info().project.name}@school.test`;
  await page.goto("/ru/register");
  await page.getByLabel("Имя", { exact: true }).fill("Тест");
  await page.getByLabel("Фамилия").fill("Учитель");
  await page.getByLabel("Электронная почта").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(page.getByText("Проверьте почту")).toBeVisible();
  const link = new URL(await verifyLink(email));
  await page.goto(link.pathname + link.search);
  await expect(page.getByText("Почта подтверждена")).toBeVisible();
  await page.goto("/ru/login");
  await page.getByLabel("Почта или логин").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти" }).last().click();
  await expect(page).toHaveURL(/\/ru\/teacher$/);
}

test("worksheet page asks to sign in", async ({ page }) => {
  await page.goto("/ru/teacher/worksheet");
  await expect(page).toHaveURL(/\/ru\/login/);
});

test.describe("worksheet generator (live, sample AI)", () => {
  test.skip(!live, "Set E2E_API_URL to a running backend with ai.generators enabled");

  test("teacher creates a worksheet with a reminder and saves the sheet and the key", async ({ page }) => {
    await signedInTeacher(page);
    await page.getByRole("link", { name: "Создать рабочий лист" }).click();
    await expect(page).toHaveURL(/\/ru\/teacher\/worksheet$/);
    await expect(page.getByTestId("credits")).toContainText("Стоимость рабочего листа: 2");

    await page.getByLabel("Предмет").fill("Русская литература");
    await page.getByLabel("Класс", { exact: true }).fill("7");
    await page.getByLabel("Тема").fill("Рассказ «Телеграмма»");
    await page.getByRole("button", { name: "Составить рабочий лист" }).click();

    const sheet = page.getByTestId("worksheet-document");
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await expect(sheet.getByTestId("worksheet-theory")).toBeVisible();
    await expect(sheet.getByTestId("quiz-question")).toHaveCount(6);
    await expect(sheet.getByTestId("quiz-key")).toHaveCount(0);
    await sheet.getByRole("button", { name: "Показать ключ" }).click();
    await expect(sheet.getByTestId("quiz-key")).toHaveCount(6);
    await expect(page.getByTestId("credits")).toContainText("Кредиты: 28");

    await page.getByRole("button", { name: "Сохранить в мои документы" }).click();
    await expect(page.getByText("Сохранено два документа.")).toBeVisible();
    await page.goto("/ru/teacher/documents?kind=worksheet");
    await expect(page.getByRole("link", { name: /Ключ: \[Учебный пример\] Рабочий лист/ })).toBeVisible();
  });
});
