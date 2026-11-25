import { expect, test, type Page } from "@playwright/test";

const live = !!process.env.E2E_API_URL;
const mailpit = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";

test.describe("auth forms without API", () => {
  test.skip(live, "Covered by the live flow when API is running");

  test("register form validates required fields in the browser", async ({ page }) => {
    await page.goto("/ru/register");
    await page.getByRole("button", { name: "Создать аккаунт" }).click();

    await expect(page.getByText("Заполните поле.")).toHaveCount(4);
    const firstName = page.getByLabel("Имя", { exact: true });
    await expect(firstName).toHaveAttribute("aria-invalid", "true");
  });

  test("short password is explained", async ({ page }) => {
    await page.goto("/en/register");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("The password must be at least 10 characters.")).toBeVisible();
  });

  test("login shows a clear error when the server is down", async ({ page }) => {
    await page.goto("/kk/login");
    await page.getByLabel("Пошта немесе логин").fill("teacher@school.test");
    await page.getByLabel("Құпия сөз", { exact: true }).fill("long enough password");
    await page.getByRole("button", { name: "Кіру" }).last().click();
    await expect(page.locator("[data-state=error]")).toContainText("EduKit сервері қолжетімсіз");
  });

  test("password can be shown and hidden", async ({ page }) => {
    await page.goto("/ru/login");
    const password = page.getByLabel("Пароль", { exact: true });
    await password.fill("secret phrase");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Показать пароль" }).click();
    await expect(password).toHaveAttribute("type", "text");
  });
});

test("teacher cabinet without a session redirects to sign-in", async ({ page }) => {
  await page.goto("/ru/teacher");
  await expect(page).toHaveURL(/\/ru\/login\?next=%2Fru%2Fteacher|\/ru\/login\?next=\/ru\/teacher/);
  await expect(page.getByRole("heading", { name: "Вход в EduKit" })).toBeVisible();
});

/** Ссылка из последнего письма адресату в Mailpit. */
async function linkFromMail(email: string, path: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const list = await (await fetch(`${mailpit}/api/v1/messages?limit=50`)).json();
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

async function login(page: Page, email: string, password: string, next = "") {
  await page.goto(`/ru/login${next}`);
  await page.getByLabel("Почта или логин").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти" }).last().click();
}

test.describe("live teacher flow", () => {
  test.skip(!live, "Set E2E_API_URL (and E2E_MAILPIT_URL) to a running backend with Mailpit");
  test.describe.configure({ mode: "serial" });

  const email = `e2e-${Date.now()}@school.test`;
  const password = "e2e long passphrase";

  test("register, confirm email, sign in, see sessions, sign out", async ({ page }) => {
    await page.goto("/ru/register");
    await page.getByLabel("Имя", { exact: true }).fill("Тест");
    await page.getByLabel("Фамилия").fill("Учитель");
    await page.getByLabel("Электронная почта").fill(email);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Создать аккаунт" }).click();
    await expect(page.getByText("Проверьте почту")).toBeVisible();

    // Ссылка из письма ведёт на frontend; открываем её путь на тестовом сервере.
    const link = new URL(await linkFromMail(email, "verify-email"));
    await page.goto(link.pathname + link.search);
    await expect(page.getByText("Почта подтверждена")).toBeVisible();

    await login(page, email, password, "?next=https://evil.example/");
    await expect(page).toHaveURL(/\/ru\/teacher$/);
    await expect(page.getByRole("heading", { name: "Здравствуйте, Тест!" })).toBeVisible();

    await page.getByRole("link", { name: "Мои входы" }).click();
    await expect(page.getByText("Это устройство")).toBeVisible();

    await page.goto("/ru/teacher");
    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page).toHaveURL(/\/ru\/login$/);
    await page.goto("/ru/teacher");
    await expect(page).toHaveURL(/\/ru\/login\?next=/);
  });

  test("wrong password gets a generic message", async ({ page }) => {
    await login(page, email, "definitely wrong password");
    await expect(page.locator("[data-state=error]")).toContainText("Неверная почта или пароль");
  });

  test("forgot password sends a reset link that sets a new password", async ({ page }) => {
    await page.goto("/ru/forgot-password");
    await page.getByLabel("Электронная почта").fill(email);
    await page.getByRole("button", { name: "Отправить ссылку" }).click();
    await expect(page.getByText("Письмо отправлено")).toBeVisible();

    const link = new URL(await linkFromMail(email, "reset-password"));
    await page.goto(link.pathname + link.search);
    await page.getByLabel("Новый пароль", { exact: true }).fill("brand new e2e phrase");
    await page.getByRole("button", { name: "Сохранить пароль" }).click();
    await expect(page.getByText("Пароль изменён")).toBeVisible();

    await login(page, email, "brand new e2e phrase");
    await expect(page).toHaveURL(/\/ru\/teacher$/);
  });
});
