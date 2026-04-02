"use client";

import { motion } from "framer-motion";

const frameworks = [
  { name: "OpenAI", letter: "OA" },
  { name: "Anthropic", letter: "AN" },
  { name: "Google Gemini", letter: "GG" },
  { name: "Mistral", letter: "MI" },
  { name: "Groq", letter: "GQ" },
  { name: "Cohere", letter: "CO" },
  { name: "Together AI", letter: "TG" },
  { name: "Fireworks AI", letter: "FW" },
  { name: "Azure OpenAI", letter: "AZ" },
  { name: "Ollama", letter: "OL" },
];

interface SocialProofDict {
  title: string;
  subtitle: string;
  quote: string;
  quoteAttribution: string;
}

export function SocialProof({ dict }: { dict: SocialProofDict }) {
  return (
    <section className="py-20 border-y border-navy-light/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl font-bold text-center text-white mb-4"
        >
          {dict.title}
        </motion.h2>
        <p className="text-center text-slate-gray mb-12">
          {dict.subtitle}
        </p>

        {/* Framework logos */}
        <div className="flex flex-wrap justify-center gap-8 mb-16">
          {frameworks.map((fw) => (
            <motion.div
              key={fw.name}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 rounded-xl bg-navy-mid border border-navy-light flex items-center justify-center text-slate-gray font-mono text-sm font-bold">
                {fw.letter}
              </div>
              <span className="text-xs text-slate-gray">{fw.name}</span>
            </motion.div>
          ))}
        </div>

        {/* Quote */}
        <motion.blockquote
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="relative">
            <span className="absolute -top-6 -left-2 text-6xl text-electric-blue/20 font-serif">
              &ldquo;
            </span>
            <p className="text-xl sm:text-2xl text-off-white italic leading-relaxed">
              {dict.quote}
            </p>
            <span className="absolute -bottom-8 right-0 text-6xl text-electric-blue/20 font-serif">
              &rdquo;
            </span>
          </div>
          <footer className="mt-8 text-sm text-slate-gray">
            {dict.quoteAttribution}
          </footer>
        </motion.blockquote>
      </div>
    </section>
  );
}
