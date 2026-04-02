import { getDictionary } from "./dictionaries";
import { HeroSection } from "@/components/landing/HeroSection";
import { CodeSplitScreen } from "@/components/landing/CodeSplitScreen";
import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import { SocialProof } from "@/components/landing/SocialProof";
import { EUAIActBanner } from "@/components/landing/EUAIActBanner";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { ComparisonTable } from "@/components/landing/ComparisonTable";

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <>
      <HeroSection lang={lang} dict={dict.hero} />
      <div className="flex items-center justify-center py-4">
        <div className="flex items-center gap-2 px-4 py-2 border border-gold/40 rounded-full bg-gold/10 backdrop-blur">
          <span className="text-gold text-sm font-medium">{dict.patentBadge}</span>
        </div>
      </div>
      <section className="py-8 sm:py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="glass rounded-2xl p-2 border border-navy-light/50 shadow-2xl shadow-electric-blue/5">
            <img
              src="/demo.gif"
              alt="AeneasSoft — Safe Pause & Resume in action"
              className="w-full rounded-xl"
              loading="eager"
            />
          </div>
        </div>
      </section>
      <CodeSplitScreen dict={dict.codeSplit} />
      <FeaturesGrid dict={dict.features} />
      <ComparisonTable dict={dict.comparison} />
      <SocialProof dict={dict.socialProof} />
      <EUAIActBanner lang={lang} dict={dict.euAiAct} />
      <FAQ dict={dict.faq} />
      <FinalCTA lang={lang} dict={dict.finalCta} />
    </>
  );
}
