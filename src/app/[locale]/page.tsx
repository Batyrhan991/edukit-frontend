import { formatKzt } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

// Утверждённые цены (ТЗ FR-09). Объём кредитов не публикуется до замеров.
const plans = [
  { key: "free", price: 0 },
  { key: "pro", price: 1990 },
  { key: "premium", price: 3990 },
] as const;

const featureKeys = ["ai", "games", "assessment", "organizations"] as const;

export default async function LandingPage() {
  const { locale, t } = await getDictionary();
  const l = t.landing;

  return (
    <>
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-20">
          <div className="flex flex-col justify-center gap-5">
            <p className="w-fit border border-primary px-2 py-1 text-sm text-foreground">{l.badge}</p>
            <h1 className="max-w-[18ch] text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{l.title}</h1>
            <p className="max-w-prose text-lg text-muted-foreground">{l.subtitle}</p>
            <p className="max-w-prose border-l-4 border-primary pl-4 text-sm">{l.pilotNote}</p>
          </div>

          {/* Статичный пример структуры КСП на «тетрадном» листе. Не интерактивен и не выдаёт себя за генерацию. */}
          <figure className="self-center">
            <div className="squared-paper border border-border p-6 shadow-[6px_6px_0_0_var(--primary)]">
              <p className="text-sm text-muted-foreground">{l.sample.subject}</p>
              <p className="mb-4 text-lg font-semibold">КСП / ҚМЖ</p>
              <ol className="divide-y divide-border border border-border bg-card">
                {l.sample.rows.map((row) => (
                  <li key={row} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>{row}</span>
                    <span aria-hidden className="h-2 w-16 bg-secondary sm:w-24" />
                  </li>
                ))}
              </ol>
            </div>
            <figcaption className="mt-3 text-sm text-muted-foreground">{l.sample.caption}</figcaption>
          </figure>
        </div>
      </section>

      <section id="features" aria-labelledby="features-title" className="scroll-mt-4 border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 id="features-title" className="mb-8 text-2xl font-bold tracking-tight">
            {l.featuresTitle}
          </h2>
          <ul className="grid border-l border-t border-border sm:grid-cols-2">
            {featureKeys.map((key) => (
              <li key={key} className="border-b border-r border-border bg-card p-6">
                <h3 className="text-lg font-semibold">{l.features[key].title}</h3>
                <p className="mt-2 text-muted-foreground">{l.features[key].text}</p>
                <p className="mt-4 text-sm text-secondary-foreground">
                  <span className="bg-secondary px-2 py-0.5">{l.plannedLabel}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-4 border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 id="pricing-title" className="text-2xl font-bold tracking-tight">
            {l.pricingTitle}
          </h2>
          <p className="mt-2 max-w-prose text-muted-foreground">{l.pricingNote}</p>
          <ul className="mt-8 grid border-l border-t border-border sm:grid-cols-3">
            {plans.map((plan) => (
              <li key={plan.key} className="border-b border-r border-border bg-card p-6">
                <h3 className="font-semibold">{l.plans[plan.key]}</h3>
                <p className="mt-3 text-3xl font-bold tabular-nums">{formatKzt(plan.price, locale)}</p>
                <p className="text-sm text-muted-foreground">{l.perMonth}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-4">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 id="faq-title" className="mb-6 text-2xl font-bold tracking-tight">
            {l.faqTitle}
          </h2>
          <div className="divide-y divide-border border-y border-border">
            {l.faq.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="mr-2 inline-block text-primary group-open:rotate-90" aria-hidden>
                    ›
                  </span>
                  {item.q}
                </summary>
                <p className="mt-2 pl-5 text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
