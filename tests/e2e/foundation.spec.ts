import { expect, test } from "@playwright/test";

const titles = {
  kk: "Күнделікті жұмыс азаяды — оқушыларға уақыт көбейеді",
  ru: "Меньше рутины — больше времени на учеников",
  en: "Less routine, more time for students",
} as const;

test.describe("locale routing", () => {
  // Playwright формирует Accept-Language из языка браузера.
  test("root redirects according to Accept-Language", async ({ browser, baseURL }) => {
    for (const [browserLocale, expected] of [
      ["kk-KZ", "/kk"],
      ["en-US", "/en"],
      ["de-DE", "/ru"],
    ] as const) {
      const context = await browser.newContext({ baseURL, locale: browserLocale });
      const page = await context.newPage();
      await page.goto("/");
      await expect(page).toHaveURL(new RegExp(`${expected}$`));
      await context.close();
    }
  });

  for (const [locale, title] of Object.entries(titles)) {
    test(`landing renders in ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.getByText("1 990").or(page.getByText("1,990")).first()).toBeVisible();
    });
  }

  test("language switcher keeps the current page", async ({ page }) => {
    await page.goto("/ru/design");
    await page.getByRole("link", { name: "Қазақша" }).click();
    await expect(page).toHaveURL(/\/kk\/design$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  });
});

test("theme can be switched to dark and back", async ({ page }) => {
  await page.goto("/en");
  await page.getByText("Dark", { exact: true }).click({ force: true });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByText("Light", { exact: true }).click({ force: true });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("skip link is the first keyboard stop", async ({ page }) => {
  await page.goto("/ru");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Перейти к содержанию" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("design page shows all Kazakh letters", async ({ page }) => {
  await page.goto("/kk/design");
  await expect(page.getByTestId("kazakh-letters")).toHaveText("Әә Ғғ Ққ Ңң Өө Ұұ Үү Һһ Іі");
});

test("status page shows a recoverable error when the API is down", async ({ page }) => {
  test.skip(!!process.env.E2E_API_URL, "API is configured: covered by the live API test");
  await page.goto("/ru/status");
  // У Next.js есть свой служебный элемент role=alert (объявления навигации), поэтому ищем панель по data-state.
  const alert = page.locator("[data-state=error]");
  await expect(alert).toContainText("Сервер недоступен");
  await expect(alert.getByRole("link", { name: "Повторить" })).toBeVisible();
});

test("status page lists all modules with their state when the API is up", async ({ page }) => {
  test.skip(!process.env.E2E_API_URL, "Set E2E_API_URL to a running backend");
  await page.goto("/en/status");
  const modules = page.getByTestId("system-modules");
  const items = modules.getByRole("listitem");
  await expect(items).toHaveCount(15);
  // Каждый модуль подписан текстом, а не только цветом. В Development включён только вход (identity).
  for (const item of await items.all()) {
    await expect(item).toContainText(/Enabled|Disabled/);
  }
});

test("unknown page shows branded 404 with a way home", async ({ page }) => {
  const response = await page.goto("/ru/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Страница не найдена")).toBeVisible();
  await expect(page.getByRole("link", { name: "На главную" })).toHaveAttribute("href", "/ru");
});

for (const path of ["/kk", "/ru/design", "/en/status"]) {
  test(`no horizontal scroll on ${path}`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("unknown locale segment still shows the branded 404", async ({ page }) => {
  const response = await page.goto("/api-docs.v2");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Страница не найдена")).toBeVisible();
});

test("locale redirect varies by Accept-Language", async ({ request }) => {
  const response = await request.get("/", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["vary"]).toContain("Accept-Language");
});
