import { getDictionary } from "../dictionaries";

export const metadata = { title: "About" };

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-6">{dict.about.title}</h1>
        <p className="text-lg text-slate-gray leading-relaxed mb-8">{dict.about.mission}</p>
        <div className="glass rounded-xl p-6">
          <p className="text-slate-gray leading-relaxed">{dict.about.openSource}</p>
        </div>
        {dict.about.founderText && (
          <div className="glass rounded-xl p-6 mt-6">
            <p className="text-slate-gray leading-relaxed italic">{dict.about.founderText}</p>
          </div>
        )}
      </div>
    </section>
  );
}
