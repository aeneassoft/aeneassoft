"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

interface EUAIActDict {
  badge: string;
  title: string;
  titleHighlight: string;
  subtitle: string;
  description: string;
  cta: string;
}

export function EUAIActBanner({ lang, dict }: { lang: string; dict: EUAIActDict }) {
  return (
    <section className="py-16 sm:py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-red-900/30 via-gold/10 to-red-900/30" />
      <div className="absolute inset-0 bg-gradient-to-b from-deep-navy/50 via-transparent to-deep-navy/50" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-gold/10 border border-gold/30 px-4 py-1.5 mb-6 animate-pulse">
            <AlertTriangle className="w-4 h-4 text-gold" />
            <span className="text-sm font-semibold text-gold">
              {dict.badge}
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {dict.title}{" "}
            <span className="text-gold">{dict.titleHighlight}</span>
          </h2>
          <h3 className="text-2xl sm:text-3xl font-bold text-off-white/80 mb-6">
            {dict.subtitle}
          </h3>

          <p className="text-lg text-slate-gray max-w-3xl mx-auto mb-8">
            {dict.description}
          </p>

          <Link
            href={`/${lang}/playground`}
            className="inline-flex items-center rounded-lg bg-gold px-6 py-3 text-base font-semibold text-deep-navy hover:bg-gold/90 transition-colors shadow-lg shadow-gold/20"
          >
            {dict.cta}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
