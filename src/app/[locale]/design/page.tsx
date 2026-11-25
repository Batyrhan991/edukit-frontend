import { LoadingPanel, StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";

const swatches = [
  { name: "primary", fg: "primary-foreground" },
  { name: "secondary", fg: "secondary-foreground" },
  { name: "background", fg: "foreground" },
  { name: "card", fg: "card-foreground" },
  { name: "muted", fg: "muted-foreground" },
  { name: "destructive", fg: "destructive-foreground" },
  { name: "success", fg: "success-foreground" },
  { name: "warning", fg: "warning-foreground" },
] as const;

// Девять специфических казахских букв (І — кириллическая U+0406).
const kazakhLetters = "Әә Ғғ Ққ Ңң Өө Ұұ Үү Һһ Іі";

export default async function DesignPage() {
  const { t } = await getDictionary();
  const d = t.design;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-12 px-4 py-12 sm:px-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{d.title}</h1>
        <p className="mt-2 max-w-prose text-muted-foreground">{d.intro}</p>
      </header>

      <section aria-labelledby="colors">
        <h2 id="colors" className="mb-4 text-xl font-semibold">
          {d.colorsTitle}
        </h2>
        <ul className="grid grid-cols-2 border-l border-t border-border sm:grid-cols-4">
          {swatches.map(({ name, fg }) => (
            <li
              key={name}
              className="border-b border-r border-border p-4"
              style={{ background: `var(--${name})`, color: `var(--${fg})` }}
            >
              <span className="block font-semibold">{name}</span>
              <span className="text-sm">Aa Әә 123</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="type">
        <h2 id="type" className="mb-4 text-xl font-semibold">
          {d.typographyTitle}
        </h2>
        <div className="space-y-2 border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">{d.kazakhSample}</p>
          <p lang="kk" className="text-3xl font-bold" data-testid="kazakh-letters">
            {kazakhLetters}
          </p>
          <p lang="kk" className="text-base">
            Қазақстан мұғалімдеріне арналған ғылыми-әдістемелік үлгі: өңдеу, үйрену, һәм тексеру.
          </p>
        </div>
      </section>

      <section aria-labelledby="buttons">
        <h2 id="buttons" className="mb-4 text-xl font-semibold">
          {d.buttonsTitle}
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button>{d.primary}</Button>
          <Button variant="secondary">{d.secondary}</Button>
          <Button variant="outline">{d.outline}</Button>
          <Button disabled>{d.disabled}</Button>
        </div>
      </section>

      <section aria-labelledby="states" className="space-y-3">
        <h2 id="states" className="mb-4 text-xl font-semibold">
          {d.statesTitle}
        </h2>
        <LoadingPanel label={t.states.loading} />
        <StatePanel variant="empty" title={t.states.emptyTitle}>
          {t.states.emptyText}
        </StatePanel>
        <StatePanel variant="error" title={t.states.errorTitle} action={<Button variant="outline">{t.states.retry}</Button>}>
          {t.states.errorText}
        </StatePanel>
        <StatePanel variant="offline" title={t.states.offlineTitle}>
          {t.states.offlineText}
        </StatePanel>
        <StatePanel variant="success" title={t.states.successTitle}>
          {t.states.successText}
        </StatePanel>
        <StatePanel variant="forbidden" title={t.states.forbiddenTitle}>
          {t.states.forbiddenText}
        </StatePanel>
      </section>
    </div>
  );
}
