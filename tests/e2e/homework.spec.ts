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
  const email = `e2e-hw-${Date.now()}-${test.info().project.name}@school.test`;
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

test("homework page asks to sign in", async ({ page }) => {
  await page.goto("/ru/teacher/homework");
  await expect(page).toHaveURL(/\/ru\/login/);
});

test.describe("homework generator (live, sample AI)", () => {
  test.skip(!live, "Set E2E_API_URL to a running backend with ai.generators enabled");

  test("teacher creates three-level homework and saves the sheet and the key", async ({ page }) => {
    await signedInTeacher(page);
    await page.getByRole("link", { name: "Создать домашнее задание" }).click();
    await expect(page).toHaveURL(/\/ru\/teacher\/homework$/);
    await expect(page.getByTestId("credits")).toContainText("Стоимость домашнего задания: 2");

    await page.getByLabel("Предмет").fill("Русская литература");
    await page.getByLabel("Класс", { exact: true }).fill("7");
    await page.getByLabel("Тема").fill("Рассказ «Телеграмма»");
    await page.getByLabel("Заданий на каждом уровне (1–4)").fill("2");
    await page.getByRole("button", { name: "Составить домашнее задание" }).click();

    const hw = page.getByTestId("homework-document");
    await expect(hw).toBeVisible({ timeout: 20_000 });
    await expect(hw.getByTestId("homework-level")).toHaveCount(3);
    await expect(hw.getByRole("heading", { name: "Уровень C — творческий" })).toBeVisible();
    await expect(hw.getByTestId("quiz-question")).toHaveCount(6);
    await expect(hw.getByTestId("quiz-key")).toHaveCount(0);
    await hw.getByRole("button", { name: "Показать ключ" }).click();
    await expect(hw.getByTestId("quiz-key")).toHaveCount(6);
    await expect(page.getByTestId("credits")).toContainText("Кредиты: 28");

    await page.getByRole("button", { name: "Сохранить в мои документы" }).click();
    await expect(page.getByText("Сохранено два документа.")).toBeVisible();
    await page.goto("/ru/teacher/documents?kind=homework");
    await expect(page.getByRole("link", { name: /Ключ: \[Учебный пример\] Домашнее задание/ })).toBeVisible();
  });
});
