# EduKit frontend

Интерфейс EduKit: Next.js 16 (App Router, Cache Components), React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui. Языки kk/ru/en, темы светлая/тёмная/системная, стиль Ocean Blue. Требования — [docs/TECHNICAL_SPEC.md](docs/TECHNICAL_SPEC.md), статус — [docs/PROGRESS.md](docs/PROGRESS.md).

> Состояние: **этап 0 (фундамент)**. Есть публичная страница, страница дизайн-системы и страница состояния системы. Вход, кабинеты и модули появятся в следующих этапах.

## Запуск

Нужен Node.js 24 (`.nvmrc`).

```bash
npm ci
cp .env.example .env.local      # адрес API, по умолчанию http://localhost:5080
npm run dev                     # http://localhost:3000 → перенаправит на /ru, /kk или /en
```

Страницы: `/{locale}` — описание продукта и тарифы; `/{locale}/design` — токены, шрифт и состояния интерфейса; `/{locale}/status` — модули, о которых сообщает API (без запущенного backend показывает понятную ошибку с кнопкой «Повторить»).

## Проверки

```bash
npm run lint
npm run typecheck      # генерирует типы маршрутов и запускает tsc
npm test               # Vitest: словари kk/ru/en, выбор языка, формат KZT, контраст токенов WCAG
npm run build
npx playwright install chromium
npm run test:e2e       # Playwright: 1440 px и 360 px
```

Совместная проверка с backend: запустите API (см. README backend) и выполните `E2E_API_URL=http://localhost:5080 npm run test:e2e` — тогда проверяется список модулей с реального сервера.

## Контракт API

Копия OpenAPI из backend лежит в [contracts/openapi.json](contracts/openapi.json). После изменения контракта:

```bash
cp ../edukit-backend/docs/openapi/EduKit.Api.json contracts/openapi.json
npm run api:generate   # обновит src/lib/api/schema.d.ts
```

CI проверяет, что типы соответствуют контракту.

## Структура

```text
src/app/[locale]/        страницы; [locale] = kk | ru | en
src/proxy.ts             добавляет язык к адресу (только маршрутизация, не авторизация)
src/i18n/                языки, выбор по Accept-Language, форматирование KZT
src/components/          шапка, переключатели языка и темы, состояния экрана
src/components/ui/       компоненты shadcn/ui
src/lib/api/             типизированный серверный клиент API
messages/{kk,ru,en}.json словари
tests/unit, tests/e2e    Vitest и Playwright
```

Документы: [AGENTS.md](AGENTS.md), [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md), [docs/DECISIONS.md](docs/DECISIONS.md).
