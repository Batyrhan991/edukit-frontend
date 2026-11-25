import { expect, test, type Locator, type Page } from "@playwright/test";

// E2E_GOOGLE=1 — API запущен с тестовым (не настоящим) ключом Google. Настоящую страницу Google не открываем:
// адрес кнопки запрашивается без перехода по перенаправлению (cookie браузера общие), проверяется адрес Google.
const google = !!process.env.E2E_GOOGLE;
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

/** Запрос по ссылке-кнопке в контексте браузера (cookie сохраняются), без перехода на сам Google. */
async function googleAddress(page: Page, link: Locator): Promise<URL> {
  const href = await link.getAttribute("href");
  expect(href).not.toBeNull();
  const response = await page.request.get(href!, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  const location = new URL(response.headers()["location"]);
  expect(location.origin).toBe("https://accounts.google.com");
  return location;
}

/** Учитель с паролем: регистрация → подтверждение → вход. */
async function signedInTeacher(page: Page) {
  const email = `e2e-google-${Date.now()}-${test.info().project.name}@school.test`;
  await page.goto("/ru/register");
  await page.getByLabel("Имя", { exact: true }).fill("Тест");
  await page.getByLabel("Фамилия").fill("Гугл");
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

test.describe("sign-in with Google: messages and steps", () => {
  test("error from the Google return is shown on the login page", async ({ page }) => {
    await page.goto("/ru/login?error=google_conflict");
    await expect(page.locator("[data-state=error]")).toContainText("уже связана с другим аккаунтом Google");

    await page.goto("/en/login?error=google_cancelled");
    await expect(page.locator("[data-state=error]")).toContainText("Google sign-in was cancelled");
  });

  test("existing account is asked to sign in with password and connect Google", async ({ page }) => {
    await page.goto("/ru/login?error=google_link_required");
    await expect(page.locator("[data-state=error]")).toContainText("подключите Google в разделе «Безопасность»");
  });

  test("unknown error value is ignored", async ({ page }) => {
    await page.goto("/ru/login?error=<b>hacked</b>");
    await expect(page.getByLabel("Почта или логин")).toBeVisible();
    await expect(page.locator("[data-state=error]")).toHaveCount(0);
  });

  test("return with step=mfa opens the code step", async ({ page }) => {
    await page.goto("/ru/login?step=mfa");
    await expect(page.getByText("Подтверждение входа")).toBeVisible();
    await expect(page.getByLabel("Код из приложения")).toBeVisible();
  });

  test("Google button is hidden when the server has no Google key", async ({ page }) => {
    test.skip(google, "API is configured with a Google key");
    await page.goto("/ru/login");
    await expect(page.getByLabel("Почта или логин")).toBeVisible();
    await expect(page.getByRole("link", { name: "Войти через Google" })).toHaveCount(0);
  });
});

test.describe("sign-in with Google (live, test key)", () => {
  test.skip(!google, "Set E2E_GOOGLE=1 and E2E_API_URL to an API started with Auth__Google__ClientId");

  test("button leads to Google with PKCE, state and the site callback", async ({ page, baseURL }) => {
    await page.goto("/ru/login?next=/ru/settings/sessions");
    await page.getByRole("checkbox", { name: "Запомнить меня" }).click();
    const button = page.getByRole("link", { name: "Войти через Google" });
    await expect(button).toHaveAttribute("href", /remember=true/);
    await expect(button).toHaveAttribute("href", /next=%2Fru%2Fsettings%2Fsessions/);
    const url = await googleAddress(page, button);

    expect(url).not.toBeNull();
    expect(url!.pathname).toBe("/o/oauth2/v2/auth");
    expect(url!.searchParams.get("redirect_uri")).toBe(`${baseURL}/api/v1/auth/google/callback`);
    expect(url!.searchParams.get("response_type")).toBe("code");
    expect(url!.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url!.searchParams.get("code_challenge")).toMatch(/^[\w-]{43}$/);
    expect(url!.searchParams.get("state")).toMatch(/^[\w-]{43}$/);
    expect(url!.searchParams.get("nonce")).toMatch(/^[\w-]{43}$/);
    expect(url!.searchParams.get("hl")).toBe("ru");
    // Ни секрета, ни адреса возврата на странице в адресе Google нет.
    expect(url!.toString()).not.toContain("secret");
    expect(url!.toString()).not.toContain("settings");

    // Пользователь нажал «Отмена» на странице Google.
    await page.goto(`/api/v1/auth/google/callback?error=access_denied&state=${url!.searchParams.get("state")}`);
    await expect(page).toHaveURL(/\/ru\/login\?error=google_cancelled$/);
    await expect(page.locator("[data-state=error]")).toContainText("Вход через Google отменён");
  });

  test("return without the browser's own state is refused", async ({ page }) => {
    await page.goto("/api/v1/auth/google/callback?code=stolen&state=forged");
    await expect(page).toHaveURL(/\/ru\/login\?error=google_failed$/);
    await expect(page.locator("[data-state=error]")).toContainText("Не удалось войти через Google");
    await page.goto("/ru/teacher");
    await expect(page).toHaveURL(/\/ru\/login/);
  });

  test("registration page offers Google too", async ({ page }) => {
    await page.goto("/kk/register");
    await expect(page.getByRole("link", { name: "Google арқылы тіркелу" })).toBeVisible();
  });

  test("teacher connects Google from Security: leads to Google, cancel is reported", async ({ page }) => {
    await signedInTeacher(page);

    await page.goto("/ru/settings/security");
    await expect(page.getByRole("heading", { name: "Вход через Google" })).toBeVisible();
    await expect(page.getByText("Google не подключён")).toBeVisible();
    const url = await googleAddress(page, page.getByRole("link", { name: "Подключить Google" }));
    expect(url!.searchParams.get("code_challenge_method")).toBe("S256");

    await page.goto(`/api/v1/auth/google/callback?error=access_denied&state=${url!.searchParams.get("state")}`);
    await expect(page).toHaveURL(/\/ru\/settings\/security\?google=google_cancelled$/);
    await expect(page.locator("[data-state=error]")).toContainText("Подключение Google отменено");
    await expect(page.getByText("Google не подключён")).toBeVisible();
  });
});
