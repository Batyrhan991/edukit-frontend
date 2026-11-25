<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# EduKit frontend — инструкции агенту

- Прочитай docs/TECHNICAL_SPEC.md перед изменениями. Последние утверждённые решения важнее предположений. Решения — docs/DECISIONS.md, статус — docs/PROGRESS.md, дизайн — docs/DESIGN_SYSTEM.md.
- Не меняй стек, требования, роли, тарифы или сроки хранения без явной фиксации решения.
- Работай небольшими вертикальными инкрементами. Сначала контракт (backend) и тесты, затем UI; не ломай существующие функции.
- Сервер — источник прав доступа, баллов, платежей и AI-лимитов. Маршруты и скрытие кнопок в UI не являются авторизацией. Секреты и прямые вызовы AI/БД/платежей во frontend запрещены.
- Не коммить ключи, реальные персональные данные или production конфигурации. Используй mock в dev/test.
- UI: Ocean Blue, прямоугольные элементы (радиус ≤ 4 px), kk/ru/en, light/dark/system, responsive (360/768/1440), доступность (клавиатура, фокус, контраст, prefers-reduced-motion), состояния loading/empty/error/offline/success/forbidden.
- Все видимые строки — в `messages/{kk,ru,en}.json`; набор ключей одинаков во всех языках (проверяется тестом).
- Не добавляй непроверенные зависимости и платные сервисы без согласования. Версии точные (`save-exact`), lock-файл в git.
- Не имитируй успешную оплату, генерацию или проверку. Незавершённое скрывай по серверным флагам.
- После каждого этапа запускай lint, typecheck, unit, build, E2E; фиксируй фактический результат; обновляй README и docs/PROGRESS.md.

## Команды

```bash
npm ci
npm run lint && npm run typecheck && npm test && npm run build
npx playwright install chromium && npm run test:e2e
npm run api:generate   # после обновления contracts/openapi.json из backend
```
