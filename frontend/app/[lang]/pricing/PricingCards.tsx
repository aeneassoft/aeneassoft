"use client";

import { useState } from "react";
import Link from "next/link";

interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}

export function PricingCards({ lang, plans, mostPopularText }: { lang: string; plans: Plan[]; mostPopularText?: string }) {
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  function handleAction(planName: string) {
    const name = planName.toLowerCase();
    if (name.includes("open source")) {
      window.open("https://github.com/aeneassoft/aeneassoft", "_blank");
      return;
    }
    if (name.includes("enterprise")) {
      window.location.href = `/${lang}/contact`;
      return;
    }
    // Cloud — handled by waitlist inline
  }

  async function submitWaitlist() {
    if (!waitlistEmail) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Cloud Waitlist",
          email: waitlistEmail,
          message: "Interested in AeneasSoft Cloud (managed hosting).",
          type: "waitlist",
        }),
      });
    } catch {}
    setWaitlistSubmitted(true);
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {plans.map((plan) => {
        const isCloud = plan.name.toLowerCase().includes("cloud");

        return (
          <div
            key={plan.name}
            className={`rounded-xl p-6 sm:p-8 flex flex-col ${
              plan.highlighted
                ? "glass border-electric-blue/40 shadow-lg shadow-electric-blue/10"
                : "glass"
            }`}
          >
            {plan.highlighted && mostPopularText && (
              <span className="inline-block mb-3 rounded-full bg-electric-blue/20 border border-electric-blue/40 px-3 py-1 text-xs font-semibold text-electric-blue w-fit">
                {mostPopularText}
              </span>
            )}
            <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
            <div className="mb-4">
              <span className="text-3xl font-bold text-white">{plan.price}</span>
              <span className="text-slate-gray">{plan.period}</span>
            </div>
            <p className="text-sm text-slate-gray mb-6">{plan.description}</p>
            <ul className="space-y-2 mb-8 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="text-sm text-off-white flex items-start gap-2">
                  <span className="text-electric-blue mt-0.5">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>

            {isCloud ? (
              waitlistSubmitted ? (
                <p className="text-center text-sm text-green-400 py-2">You're on the list!</p>
              ) : (
                <div className="space-y-2">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-sm text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue"
                  />
                  <button
                    onClick={submitWaitlist}
                    className="w-full rounded-lg border border-navy-light px-4 py-2.5 text-sm font-semibold text-slate-gray hover:text-white hover:border-slate-gray transition-colors"
                  >
                    {plan.cta}
                  </button>
                </div>
              )
            ) : (
              <button
                onClick={() => handleAction(plan.name)}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? "bg-electric-blue text-white hover:bg-electric-blue/90"
                    : "border border-navy-light text-slate-gray hover:text-white hover:border-slate-gray"
                }`}
              >
                {plan.cta}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
