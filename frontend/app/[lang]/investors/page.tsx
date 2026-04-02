import { getDictionary } from "../dictionaries";
import Link from "next/link";

export const metadata = { title: "Investors" };

export default async function InvestorsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-4">{dict.investors.title}</h1>
        <p className="text-lg text-slate-gray mb-8">{dict.investors.subtitle}</p>
        <div className="space-y-4 mb-8">
          <div className="glass rounded-xl p-6">
            <p className="text-white font-medium">{dict.investors.tam}</p>
          </div>
          <div className="glass rounded-xl p-6">
            <p className="text-slate-gray leading-relaxed">{dict.investors.keyDrivers}</p>
          </div>
        </div>
        <Link href={`/${lang}/contact`}
          className="inline-flex items-center rounded-lg bg-gold px-6 py-3 text-base font-semibold text-deep-navy hover:bg-gold/90 transition-colors">
          {dict.investors.contactCta}
        </Link>
      </div>
    </section>
  );
}
