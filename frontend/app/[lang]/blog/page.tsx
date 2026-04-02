import { getDictionary } from "../dictionaries";

export const metadata = { title: "Blog" };

export default async function BlogPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">{dict.blog.title}</h1>
        <p className="text-slate-gray mb-8">{dict.blog.subtitle}</p>
        <div className="glass rounded-xl p-8">
          <p className="text-slate-gray">{dict.blog.comingSoon}</p>
        </div>
      </div>
    </section>
  );
}
