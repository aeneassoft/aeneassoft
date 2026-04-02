"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "./Logo";

interface NavDict {
  product: string;
  playground: string;
  docs: string;
  pricing: string;
  startTracing: string;
  toggleMenu: string;
  dashboard?: string;
}

export function Navbar({ lang, dict }: { lang: string; dict: NavDict }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const hasToken = /(?:^|;\s*)token=/.test(document.cookie);
    setIsLoggedIn(hasToken);
  }, []);

  const navLinks = [
    { href: `/${lang}/product`, label: dict.product },
    { href: `/${lang}/playground`, label: dict.playground },
    { href: `/${lang}/docs`, label: dict.docs },
    { href: `/${lang}/pricing`, label: dict.pricing },
  ];

  const otherLang = lang === "en" ? "de" : "en";
  const switchPath = pathname.replace(`/${lang}`, `/${otherLang}`);

  const ctaLabel = isLoggedIn ? (dict.dashboard ?? "Dashboard") : dict.startTracing;
  const ctaHref = isLoggedIn ? `/${lang}/dashboard` : `/${lang}/register`;

  return (
    <nav className="sticky top-0 z-50 border-b border-electric-blue/10" style={{ background: "rgba(10, 22, 40, 0.8)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Logo href={`/${lang}`} />

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-slate-gray hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link
              href={switchPath}
              className="text-sm font-medium text-slate-gray hover:text-white transition-colors border border-navy-light rounded-md px-2.5 py-1"
            >
              {otherLang.toUpperCase()}
            </Link>
            <Link
              href={ctaHref}
              className="inline-flex items-center rounded-lg bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-electric-blue/90 transition-colors"
            >
              {ctaLabel}
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-slate-gray hover:text-white"
            aria-label={dict.toggleMenu}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden border-t border-navy-light/50"
          >
            <div className="px-4 py-4 space-y-3 bg-deep-navy/95 backdrop-blur-xl">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm text-slate-gray hover:text-white transition-colors py-2"
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex items-center gap-3 pt-2">
                <Link
                  href={switchPath}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-medium text-slate-gray hover:text-white transition-colors border border-navy-light rounded-md px-2.5 py-2"
                >
                  {otherLang.toUpperCase()}
                </Link>
                <Link
                  href={ctaHref}
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 text-center rounded-lg bg-electric-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-electric-blue/90 transition-colors"
                >
                  {ctaLabel}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
