import Link from "next/link";
import { SpartanHelm } from "./Logo";

interface FooterDict {
  brand: string;
  brandDescription: string;
  product: string;
  features: string;
  playground: string;
  pricing: string;
  docs: string;
  resources: string;
  blog: string;
  documentation: string;
  agentTraceProtocol: string;
  discord: string;
  company: string;
  about: string;
  investors: string;
  careers: string;
  legal: string;
  privacyPolicy: string;
  imprint: string;
  termsOfService: string;
  dpa: string;
  copyright: string;
  mitOpenSource: string;
}

export function Footer({ lang, dict }: { lang: string; dict: FooterDict }) {
  const columns = [
    {
      title: dict.product,
      links: [
        { label: dict.features, href: `/${lang}/product` },
        { label: dict.playground, href: `/${lang}/playground` },
        { label: dict.pricing, href: `/${lang}/pricing` },
        { label: dict.docs, href: `/${lang}/docs` },
      ],
    },
    {
      title: dict.resources,
      links: [
        { label: dict.blog, href: `/${lang}/blog` },
        { label: dict.documentation, href: `/${lang}/docs` },
        { label: dict.discord, href: "https://discord.gg/Y9x6jf3cnu" },
      ],
    },
    {
      title: dict.company,
      links: [
        { label: dict.about, href: `/${lang}/about` },
        { label: dict.investors, href: `/${lang}/investors` },
        { label: dict.careers, href: `/${lang}/about` },
        { label: "Contact", href: `/${lang}/contact` },
      ],
    },
    {
      title: dict.legal,
      links: [
        { label: dict.privacyPolicy, href: `/${lang}/legal/privacy` },
        { label: dict.imprint, href: `/${lang}/legal/imprint` },
        { label: dict.termsOfService, href: `/${lang}/legal/terms` },
        { label: dict.dpa, href: `/${lang}/legal/dpa` },
      ],
    },
  ];

  return (
    <footer className="border-t border-navy-light/50 bg-deep-navy">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1 mb-4 lg:mb-0">
            <div className="flex items-center gap-2 mb-4">
              <SpartanHelm className="h-8 w-8" />
              <span className="text-lg font-bold text-white">{dict.brand}</span>
            </div>
            <p className="text-sm text-slate-gray max-w-xs">
              {dict.brandDescription}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-white mb-3">
                {col.title}
              </h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-gray hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-navy-light/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-gray">{dict.copyright}</p>
          <p className="text-sm text-slate-gray">{dict.mitOpenSource}</p>
        </div>
      </div>
    </footer>
  );
}
