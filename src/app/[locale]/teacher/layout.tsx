import { Suspense } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { getDictionary } from "@/i18n/dictionaries";
import { getMe, getSystemInfo } from "@/lib/api/server";

/** Кабинет учителя: на всех его страницах справа доступен AI-помощник (ТЗ FR-03, ADR-0045). */
export default function TeacherLayout({ children }: LayoutProps<"/[locale]/teacher">) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <ChatDock />
      </Suspense>
    </>
  );
}

/** Кнопка помощника — только если модуль включён и вошёл не ученик. Права всё равно проверяет API. */
async function ChatDock() {
  const { locale, t } = await getDictionary();
  const [info, me] = await Promise.all([getSystemInfo(), getMe()]);
  if (!info.ok || !info.data.features["ai.chat"] || !me.ok || me.data.baseRole === "Student") return null;
  return <ChatPanel t={t.chat} locale={locale} />;
}
