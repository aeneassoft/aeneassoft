import { getDictionary } from "../../dictionaries";
import { notFound } from "next/navigation";

const VALID_SLUGS = ["imprint", "privacy", "terms", "dpa"];

export function generateStaticParams() {
  return VALID_SLUGS.map((slug) => ({ slug }));
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;

  if (!VALID_SLUGS.includes(slug)) notFound();

  const dict = await getDictionary(lang);
  const page = dict.legal[slug as keyof typeof dict.legal] as
    | { title: string; content: string }
    | undefined;

  if (!page) notFound();

  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-8">{page.title}</h1>
        <div className="prose prose-invert max-w-none">
          {page.content.split("\n\n").map((block, i) => {
            if (block.startsWith("§") || /^\d+\./.test(block)) {
              return (
                <h2 key={i} className="text-lg font-semibold text-white mt-8 mb-3">
                  {block}
                </h2>
              );
            }
            return (
              <p key={i} className="text-slate-gray leading-relaxed mb-4 whitespace-pre-line">
                {block}
              </p>
            );
          })}
        </div>
      </div>
    </section>
  );
}
