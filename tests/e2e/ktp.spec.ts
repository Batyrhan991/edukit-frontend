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
  const email = `e2e-ktp-${Date.now()}-${test.info().project.name}@school.test`;
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

test("KTP page asks to sign in", async ({ page }) => {
  await page.goto("/ru/teacher/ktp");
  await expect(page).toHaveURL(/\/ru\/login/);
});

test.describe("KTP generator (live, sample AI)", () => {
  test.skip(!live, "Set E2E_API_URL to a running backend with ai.generators enabled");

  test("teacher creates a first-term plan with calendar dates and saves it", async ({ page }) => {
    await signedInTeacher(page);
    await page.getByRole("link", { name: "Создать КТП" }).click();
    await expect(page).toHaveURL(/\/ru\/teacher\/ktp$/);
    const credits = page.getByTestId("credits");
    await expect(credits).toContainText("Стоимость КТП: 3");

    // Без дней недели — подсказка, без запроса.
    await page.getByLabel("Предмет").fill("Русская литература");
    await page.getByLabel("Класс", { exact: true }).fill("7");
    await page.getByTestId("ktp-day-1").uncheck();
    await page.getByTestId("ktp-day-4").uncheck();
    await page.getByRole("button", { name: "Составить КТП" }).click();
    await expect(page.getByText("Проверьте значение.")).toBeVisible();

    await page.getByTestId("ktp-day-1").check();
    await page.getByTestId("ktp-day-4").check();
    await page.getByRole("button", { name: "Составить КТП" }).click();
    const plan = page.getByTestId("ktp-document");
    await expect(plan).toBeVisible({ timeout: 20_000 });
    await expect(plan.getByRole("heading", { name: /1 четверть · Уроков: 15/ })).toBeVisible();
    await expect(plan.getByRole("cell", { name: "03.09.2026" })).toBeVisible();
    await expect(page.getByTestId("ktp-hours")).toContainText("Всего часов: 15");
    await expect(credits).toContainText("Кредиты: 27");

    await page.getByRole("button", { name: "Сохранить в мои документы" }).click();
    await page.getByRole("link", { name: "Открыть документ" }).click();
    await expect(page).toHaveURL(/\/ru\/teacher\/documents\//);
    await expect(page.getByRole("textbox").getByText("03.09.2026")).toBeVisible();

    await page.goto("/ru/teacher/documents?kind=ktp");
    await expect(page.getByRole("link", { name: "Календарно-тематический план: Русская литература, 7 класс" })).toBeVisible();
  });
});
