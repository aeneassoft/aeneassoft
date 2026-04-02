import { getDictionary } from "../dictionaries";

export const metadata = { title: "Product" };

export default async function ProductPage({
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
          {dict.product.title}
        </h1>
        <p className="text-center text-slate-gray mb-16 max-w-2xl mx-auto">
          {dict.product.subtitle}
        </p>
        <div className="space-y-12">
          {dict.product.sections.map(
            (s: { title: string; description: string }, i: number) => (
              <div key={i} className="glass rounded-xl p-6 sm:p-8">
                <h2 className="text-xl font-bold text-white mb-3">{s.title}</h2>
                <p className="text-slate-gray leading-relaxed">{s.description}</p>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
