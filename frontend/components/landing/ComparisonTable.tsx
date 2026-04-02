"use client";

import { motion } from "framer-motion";

interface ComparisonDict {
  title: string;
  subtitle: string;
  headers: string[];
  rows: string[][];
}

export function ComparisonTable({ dict }: { dict: ComparisonDict }) {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl font-bold text-center text-white mb-4"
        >
          {dict.title}
        </motion.h2>
        <p className="text-center text-slate-gray mb-12">{dict.subtitle}</p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="overflow-x-auto"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-light">
                {dict.headers.map((h, i) => (
                  <th
                    key={`h-${i}`}
                    className={`pb-4 pr-6 text-left ${
                      i === 1
                        ? "text-electric-blue font-bold"
                        : "text-slate-gray font-semibold"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dict.rows.map((row, ri) => (
                <tr key={`row-${ri}`} className="border-b border-navy-light/50">
                  {row.map((cell, ci) => (
                    <td
                      key={`cell-${ri}-${ci}`}
                      className={`py-3 pr-6 ${
                        ci === 0
                          ? "text-white font-medium"
                          : ci === 1
                            ? "text-electric-blue font-semibold"
                            : "text-slate-gray"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
