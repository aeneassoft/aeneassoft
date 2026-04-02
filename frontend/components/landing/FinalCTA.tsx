"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface FinalCTADict {
  titleStart: string;
  titleHighlight: string;
  subtitle: string;
  cta: string;
}

export function FinalCTA({ lang, dict }: { lang: string; dict: FinalCTADict }) {
  return (
    <section className="py-20 sm:py-28 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-electric-blue/10 rounded-full blur-[120px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4"
        >
          {dict.titleStart} <span className="text-electric-blue">{dict.titleHighlight}</span>
        </motion.h2>
        <p className="text-lg text-slate-gray mb-10 max-w-xl mx-auto">
          {dict.subtitle}
        </p>
        <a
          href="https://github.com/aeneassoft/aeneassoft"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg bg-electric-blue px-8 py-3.5 text-base font-semibold text-white hover:bg-electric-blue/90 transition-colors shadow-lg shadow-electric-blue/20"
        >
          {dict.cta}
        </a>
      </div>
    </section>
  );
}
