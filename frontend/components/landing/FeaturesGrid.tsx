"use client";

import { motion } from "framer-motion";
import { Network, DollarSign, FileText, Shield } from "lucide-react";

const icons = [Shield, Network, DollarSign, FileText];

interface FeaturesDict {
  title: string;
  subtitle: string;
  items: Array<{ title: string; description: string }>;
}

export function FeaturesGrid({ dict }: { dict: FeaturesDict }) {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl font-bold text-center text-white mb-4"
        >
          {dict.title}
        </motion.h2>
        <p className="text-center text-slate-gray mb-16 max-w-2xl mx-auto">
          {dict.subtitle}
        </p>

        <div className="grid sm:grid-cols-2 gap-6">
          {dict.items.map((feature, i) => {
            const Icon = icons[i];
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-xl p-6 sm:p-8 hover:border-gold/40 hover:scale-[1.02] transition-all duration-200 group"
              >
                <div className="w-12 h-12 rounded-lg bg-electric-blue/10 flex items-center justify-center mb-4 group-hover:bg-electric-blue/20 transition-colors">
                  <Icon className="w-6 h-6 text-electric-blue" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-gray leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
