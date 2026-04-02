import { getDictionary } from "./dictionaries";
import { SiteShell } from "@/components/SiteShell";
import { CookieBanner } from "@/components/CookieBanner";

const locales = ["en", "de"];

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <SiteShell lang={lang} navDict={dict.nav} footerDict={dict.footer}>
      {children}
      <CookieBanner lang={lang} />
    </SiteShell>
  );
}
