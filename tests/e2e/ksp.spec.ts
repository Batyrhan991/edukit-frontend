import { expect, test, type Page } from "@playwright/test";

const live = !!process.env.E2E_API_URL;
const mailpit = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";
const password = "e2e long passphrase";

async function verifyLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = await (await fetch(`${mailpit}/api/v1/messages?limit=100`)).json();
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
  const email = `e2e-ksp-${Date.now()}-${test.info().project.name}@school.test`;
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

test("lesson plan page asks to sign in", async ({ page }) => {
  await page.goto("/ru/teacher/ksp");
  await expect(page).toHaveURL(/\/ru\/login\?next=%2Fru%2Fteacher%2Fksp|\/ru\/login\?next=\/ru\/teacher\/ksp/);
});

test.describe("lesson plan generator (live, sample AI)", () => {
  test.skip(!live, "Set E2E_API_URL to a running backend with ai.generators enabled");

  test("teacher creates a plan; credits are charged once; personal data is refused", async ({ page }) => {
    await signedInTeacher(page);
    await page.getByRole("link", { name: "Создать КСП" }).click();
    await expect(page).toHaveURL(/\/ru\/teacher\/ksp$/);
    const credits = page.getByTestId("credits");
    await expect(credits).toContainText("Кредиты: 30");
    await expect(credits).toContainText("Стоимость КСП: 3");

    // Пустая форма — подсказки у полей, без запроса.
    await page.getByRole("button", { name: "Составить КСП" }).click();
    await expect(page.getByLabel("Предмет")).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel("Предмет").fill("Русская литература");
    await page.getByLabel("Класс", { exact: true }).fill("7");
    await page.getByLabel("Тема урока").fill("Образы-персонажи в рассказе «Телеграмма»");
    await page.getByLabel("Особенности класса (необязательно)").fill("Позвонить родителям: +7 701 123 45 67");
    await page.getByRole("button", { name: "Составить КСП" }).click();
    await expect(page.getByText("Похоже на личные данные")).toBeVisible();
    await expect(credits).toContainText("Кредиты: 30");

    await page.getByLabel("Особенности класса (необязательно)").fill("2 группы");
    await page.getByRole("button", { name: "Составить КСП" }).click();

    const plan = page.getByTestId("ksp-document");
    await expect(plan).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Учебный пример: настоящий AI ещё не подключён")).toBeVisible();
    await expect(plan.getByRole("heading", { name: "Образы-персонажи в рассказе «Телеграмма»" })).toBeVisible();
    await expect(plan.getByRole("heading", { name: "Паспорт урока" })).toBeVisible();
    await expect(plan.getByRole("table")).toContainText("Организационный момент");
    await expect(plan.getByRole("heading", { name: "Ход урока" })).toBeVisible();
    await expect(credits).toContainText("Кредиты: 27");
  });
});
