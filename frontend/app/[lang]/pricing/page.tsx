import { getDictionary } from "../dictionaries";
import { PricingCards } from "./PricingCards";

export const metadata = { title: "Pricing" };

export default async function PricingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-center text-white mb-4">
          {dict.pricing.title}
        </h1>
        <p className="text-center text-slate-gray mb-16 max-w-xl mx-auto">
          {dict.pricing.subtitle}
        </p>
        <PricingCards lang={lang} plans={dict.pricing.plans} mostPopularText={dict.pricing.mostPopular} />
      </div>
    </section>
  );
}
