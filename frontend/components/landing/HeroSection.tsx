"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

interface HeroDict {
  titleStart: string;
  titleHighlight: string;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  trustedBy?: string;
}

export function HeroSection({ lang, dict }: { lang: string; dict: HeroDict }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Only animate after client hydration — prevents flash on mobile
  const fadeUp = mounted
    ? { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }
    : { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 } };

  return (
    <section className="relative overflow-hidden py-24 sm:py-32 lg:py-40">
      {/* Animated gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-electric-blue/5 via-deep-navy to-deep-navy" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-electric-blue/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-20 right-1/4 w-[400px] h-[400px] bg-gold/5 rounded-full blur-[100px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white max-w-4xl mx-auto leading-tight">
            {dict.titleStart}{" "}
            <span className="hero-gradient-text">{dict.titleHighlight}</span>
          </h1>
        </motion.div>

        <motion.p
          {...fadeUp}
          transition={{ duration: 0.6, delay: mounted ? 0.15 : 0 }}
          className="mt-6 text-lg sm:text-xl text-slate-gray max-w-2xl mx-auto"
        >
          {dict.subtitle}
        </motion.p>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: mounted ? 0.3 : 0 }}
          className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
        >
          <a
            href="https://github.com/aeneassoft/aeneassoft"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-electric-blue px-6 py-3 text-base font-semibold text-white hover:bg-electric-blue/90 transition-colors shadow-lg shadow-electric-blue/20 cta-glow"
          >
            {dict.ctaPrimary}
          </a>
          <Link
            href={`/${lang}/docs`}
            className="inline-flex items-center justify-center rounded-lg border border-navy-light px-6 py-3 text-base font-semibold text-slate-gray hover:text-white hover:border-slate-gray transition-colors"
          >
            {dict.ctaSecondary}
          </Link>
        </motion.div>

        {dict.trustedBy && (
          <motion.p
            {...fadeUp}
            transition={{ duration: 0.6, delay: mounted ? 0.45 : 0 }}
            className="mt-8 text-sm text-slate-gray/70 text-center"
          >
            {dict.trustedBy}
          </motion.p>
        )}
      </div>
    </section>
  );
}
