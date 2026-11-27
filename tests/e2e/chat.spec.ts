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
  const email = `e2e-chat-${Date.now()}-${test.info().project.name}@school.test`;
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

test("guests do not get the AI assistant", async ({ page }) => {
  await page.goto("/ru");
  await expect(page.getByTestId("chat-open")).toHaveCount(0);
});

test.describe("AI assistant (live, sample AI)", () => {
  test.skip(!live, "Set E2E_API_URL to a running backend with ai.chat enabled");

  test("teacher asks, gets an answer, saves a preference and deletes the conversation", async ({ page }) => {
    await signedInTeacher(page);
    await page.getByTestId("chat-open").click();
    const panel = page.getByTestId("chat-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("chat-price")).toContainText("Вопрос стоит 1 кр.");
    await expect(panel.getByText("Бесед пока нет")).toBeVisible();

    await panel.getByRole("button", { name: "Новая беседа" }).click();
    const input = panel.getByTestId("chat-input");

    // Пустой вопрос и личные данные — отказ без списания.
    await panel.getByTestId("chat-send").click();
    await expect(panel.getByText("Напишите текст.")).toBeVisible();
    await input.fill("Позвоните маме: +7 701 123 45 67");
    await input.press("Enter");
    await expect(panel.getByText("В тексте есть личные данные")).toBeVisible();

    await input.fill("Запомни: веду русскую литературу в 7 классе");
    await input.press("Enter");
    const answer = panel.getByTestId("chat-answer");
    await expect(answer).toContainText("Учебный пример без AI", { timeout: 20_000 });
    await expect(answer).toContainText("веду русскую литературу в 7 классе");
    await expect(input).toHaveValue("");

    await answer.getByRole("button", { name: /Запомнить/ }).click();
    await expect(answer.getByRole("button", { name: /Запомнить/ })).toHaveCount(0);

    // Панель остаётся открытой при переходе по кабинету; Esc закрывает её.
    await panel.getByRole("button", { name: "Все беседы" }).click();
    await expect(panel.getByTestId("chat-conversations")).toContainText("Запомни: веду русскую литературу");
    await panel.getByRole("button", { name: "Мои предпочтения" }).click();
    await expect(panel.getByTestId("memory-items")).toContainText("веду русскую литературу в 7 классе");
    await panel.getByRole("button", { name: "Удалить запись" }).click();
    await expect(panel.getByText("Записей пока нет.")).toBeVisible();

    await panel.getByRole("button", { name: "Все беседы" }).click();
    await panel.getByTestId("chat-conversations").getByRole("button").first().click();
    await panel.getByRole("button", { name: "Удалить беседу" }).click();
    await panel.getByRole("button", { name: "Да, удалить" }).click();
    await expect(panel.getByText("Бесед пока нет")).toBeVisible();

    await panel.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(page.getByTestId("chat-open")).toBeFocused();
  });

  test("teacher attaches a text file, the answer uses it, and wrong files are refused", async ({ page }) => {
    await signedInTeacher(page);
    await page.getByTestId("chat-open").click();
    const panel = page.getByTestId("chat-panel");
    await panel.getByRole("button", { name: "Новая беседа" }).click();

    // Неподходящий тип — отказ ещё до отправки.
    await panel.getByTestId("chat-file-input").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) });
    await expect(panel.getByText("Подходят только PDF, Word (.docx) и текст (.txt)")).toBeVisible();

    await panel.getByTestId("chat-file-input").setInputFiles({ name: "заметки.txt", mimeType: "text/plain", buffer: Buffer.from("Заметки к уроку: начать с вопроса о письмах.") });
    const files = panel.getByTestId("chat-files");
    await expect(files).toContainText("заметки.txt");
    await expect(files).toContainText("1 КБ");

    await panel.getByTestId("chat-input").fill("Что в моих заметках?");
    await panel.getByTestId("chat-input").press("Enter");
    await expect(panel.getByTestId("chat-answer")).toContainText("Прочитаны файлы: заметки.txt", { timeout: 20_000 });

    await panel.getByRole("button", { name: "Убрать файл «заметки.txt»" }).click();
    await expect(panel.getByTestId("chat-files")).toHaveCount(0);
  });

  test("teacher searches the web: sample results with links, two credits", async ({ page }) => {
    await signedInTeacher(page);
    await page.getByTestId("chat-open").click();
    const panel = page.getByTestId("chat-panel");
    await expect(panel.getByTestId("chat-price")).toContainText("баланс 30 кр.");
    await panel.getByRole("button", { name: "Новая беседа" }).click();

    await panel.getByTestId("chat-web").check();
    await expect(panel.getByText("Вопрос стоит 2 кр.")).toBeVisible();
    await panel.getByTestId("chat-input").fill("Какие новости о школьной программе?");
    await panel.getByTestId("chat-input").press("Enter");
    const answer = panel.getByTestId("chat-answer");
    await expect(answer).toContainText("Учебные результаты поиска", { timeout: 20_000 });
    const link = answer.getByTestId("chat-sources").getByRole("link").first();
    await expect(link).toHaveAttribute("href", /^https:\/\/example\.org\/edukit-sample\//);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");

    await panel.getByRole("button", { name: "Все беседы" }).click();
    await expect(panel.getByTestId("chat-price")).toContainText("баланс 29 кр.");
  });
});
