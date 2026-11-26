import { expect, test, type Locator, type Page } from "@playwright/test";

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

/** Курсор в начало строки (на узком экране заголовок переносится, End ставил бы курсор в конец первой строки). */
async function editAtStart(page: Page, line: Locator, text: string) {
  await line.click({ position: { x: 2, y: 4 } });
  await page.keyboard.press("Home");
  await page.keyboard.type(text);
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

test("documents page asks to sign in", async ({ page }) => {
  await page.goto("/ru/teacher/documents");
  await expect(page).toHaveURL(/\/ru\/login/);
  await expect(page.getByRole("banner").getByRole("link", { name: "Войти" })).toBeVisible();
});

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

    // Открыть план в редакторе, поправить, сохранить и открыть заново.
    await page.getByRole("button", { name: "Открыть в редакторе" }).click();
    await expect(page).toHaveURL(/\/ru\/teacher\/documents\/[0-9a-f-]{36}$/);
    const editor = page.getByRole("textbox", { name: "Образы-персонажи в рассказе «Телеграмма»" });
    await expect(editor).toContainText("Паспорт урока");
    await expect(editor).toContainText("Учитель: ");
    await expect(page.getByTestId("save-state")).toHaveText("Сохранено");

    await page.getByLabel("Название документа").fill("КСП 7 класс — Телеграмма");
    await editAtStart(page, editor.getByRole("heading", { name: "Образы-персонажи в рассказе «Телеграмма»" }), "Правка учителя. ");
    await expect(page.getByTestId("save-state")).toHaveText("Есть несохранённые изменения");
    const saved = page.waitForResponse((r) => r.url().includes("/api/v1/documents/") && r.request().method() === "PUT");
    await page.getByRole("button", { name: "Сохранить" }).click();
    const response = await saved;
    // Сервер принимает документ из редактора как есть (в т. ч. атрибуты, которые Tiptap добавляет сам).
    expect(response.status()).toBe(200);
    await expect(page.getByTestId("save-state")).toHaveText("Сохранено");

    const documentUrl = page.url();
    await page.reload();
    await expect(page.getByLabel("Название документа")).toHaveValue("КСП 7 класс — Телеграмма");
    await expect(page.getByRole("textbox", { name: "КСП 7 класс — Телеграмма" })).toContainText("Правка учителя. Образы-персонажи");

    // Скачивание сохранённой версии в Word и PDF (через прокси, с именем файла из названия).
    for (const [button, extension] of [["Скачать Word", "docx"], ["Скачать PDF", "pdf"]] as const) {
      const downloading = page.waitForEvent("download");
      await page.getByRole("link", { name: button }).click();
      const download = await downloading;
      expect(download.suggestedFilename()).toBe(`КСП 7 класс Телеграмма.${extension}`);
      expect(await download.failure()).toBeNull();
    }

    // С несохранёнными правками скачать нельзя — сначала сохранить.
    await editAtStart(page, page.getByRole("textbox", { name: "КСП 7 класс — Телеграмма" }).getByRole("heading").first(), "Черновик. ");
    await expect(page.getByRole("button", { name: "Скачать Word" })).toBeDisabled();
    await expect(page.getByText("Сохраните документ, чтобы скачать последние правки.")).toBeVisible();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByTestId("save-state")).toHaveText("Сохранено");

    // Вторая вкладка с устаревшей версией: сохранение не перезаписывает правку молча.
    const second = await page.context().newPage();
    await second.goto(documentUrl);
    await expect(second.getByTestId("save-state")).toHaveText("Сохранено");
    await editAtStart(page, page.getByRole("textbox", { name: "КСП 7 класс — Телеграмма" }).getByRole("heading").first(), "Вкладка 1. ");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByTestId("save-state")).toHaveText("Сохранено");

    await editAtStart(second, second.getByRole("textbox", { name: "КСП 7 класс — Телеграмма" }).getByRole("heading").first(), "Вкладка 2. ");
    await second.getByRole("button", { name: "Сохранить" }).click();
    await expect(second.getByText("Документ изменён в другой вкладке")).toBeVisible();
    await second.getByRole("button", { name: "Загрузить актуальную" }).click();
    await expect(second.getByRole("textbox", { name: "КСП 7 класс — Телеграмма" })).toContainText("Вкладка 1. ");
    await expect(second.getByRole("textbox", { name: "КСП 7 класс — Телеграмма" })).not.toContainText("Вкладка 2. ");
    await second.close();

    // Документ в списке «Мои документы».
    await page.goto("/ru/teacher/documents");
    await expect(page.getByTestId("documents")).toContainText("КСП 7 класс — Телеграмма");
  });

  test("library: search, filter by type, copy, delete; recent documents in the cabinet", async ({ page }) => {
    await signedInTeacher(page);
    const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
    for (const [title, kind] of [["КСП: Телеграмма", "ksp"], ["Заметки к уроку Абая", "text"], ["Телеграмма — вопросы", "text"]]) {
      const created = await page.request.post("/api/v1/documents", {
        headers: { "X-EduKit-Csrf": "1" },
        data: { title, kind, content: doc("Синтетический текст") },
      });
      expect(created.status()).toBe(201);
    }

    // В кабинете — последние документы, сначала самый новый; в шапке вместо «Войти» — «Мой кабинет».
    await page.goto("/ru/teacher");
    await expect(page.getByRole("banner").getByRole("link", { name: "Мой кабинет" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Войти" })).toHaveCount(0);
    await expect(page.getByTestId("recent-documents").getByRole("listitem").first()).toContainText("Телеграмма — вопросы");

    await page.getByRole("link", { name: "Все документы" }).click();
    await expect(page).toHaveURL(/\/ru\/teacher\/documents$/);
    const list = page.getByTestId("documents");
    await expect(list.getByRole("listitem")).toHaveCount(3);

    // Поиск без учёта регистра + фильтр по виду; адрес сохраняет условия.
    await page.getByLabel("Поиск по названию").fill("телеграмма");
    await page.getByRole("button", { name: "Найти" }).click();
    await expect(page).toHaveURL(/q=%D1%82/);
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await page.getByLabel("Вид").selectOption("ksp");
    await page.getByRole("button", { name: "Найти" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(list).toContainText("КСП: Телеграмма");

    await page.getByLabel("Поиск по названию").fill("нет такого");
    await page.getByRole("button", { name: "Найти" }).click();
    await expect(page.getByText("Ничего не найдено")).toBeVisible();
    await page.getByRole("link", { name: "Сбросить" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(page.getByLabel("Вид")).toHaveValue("");
    await expect(page.getByLabel("Поиск по названию")).toHaveValue("");

    // Копия появляется вверху списка с пометкой «(копия)».
    const row = list.getByRole("listitem").filter({ hasText: "КСП: Телеграмма" });
    await row.getByRole("button", { name: "Сделать копию" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(4);
    await expect(list.getByRole("listitem").first()).toContainText("КСП: Телеграмма (копия)");

    // Скачивание прямо из списка.
    const downloading = page.waitForEvent("download");
    await list.getByRole("listitem").last().getByRole("link", { name: "Скачать PDF" }).click();
    expect((await downloading).suggestedFilename()).toBe("КСП Телеграмма.pdf");

    // Удаление с подтверждением.
    page.once("dialog", (dialog) => dialog.accept());
    await list.getByRole("listitem").filter({ hasText: "Заметки к уроку Абая" }).getByRole("button", { name: "Удалить" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(list).not.toContainText("Заметки к уроку Абая");
  });
});
