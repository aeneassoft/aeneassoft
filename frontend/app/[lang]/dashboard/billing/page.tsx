"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchAPI } from "@/lib/api";

interface Billing {
  plan: string;
  renewsAt: string | null;
  usage: { traces: number; limit: number; cost_this_month_usd: number };
  stripe_customer_id: string | null;
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Perfect for getting started.",
    features: ["10,000 traces/month", "Causal graphs", "Cost attribution", "EU AI Act Art. 12 scoring", "1 API key"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$99",
    period: "/month",
    description: "Professional AI observability for growing teams.",
    features: ["100,000 traces/month", "Everything in Free", "Priority support", "Alert rules", "Unlimited API keys", "Team collaboration"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$899",
    period: "/month",
    description: "For enterprise Article 12 needs and unlimited scale.",
    features: ["Unlimited traces", "Everything in Pro", "SSO / SAML", "Custom data retention", "Dedicated support", "On-premise option", "SLA 99.9%"],
  },
];

export default function BillingPage() {
  const { lang } = useParams<{ lang: string }>();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAPI<Billing>("/api/billing")
      .then(setBilling)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade(plan: string) {
    try {
      const { url } = await fetchAPI<{ url: string }>("/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      if (url) window.location.href = url;
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handlePortal() {
    try {
      const { url } = await fetchAPI<{ url: string }>("/stripe/portal");
      if (url) window.location.href = url;
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) return <p className="text-slate-gray">Loading...</p>;

  const currentPlan = billing?.plan || "free";

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Billing</h1>

      {/* Current plan + usage */}
      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        <div className="glass rounded-xl p-6">
          <p className="text-sm text-slate-gray mb-1">Current Plan</p>
          <p className="text-2xl font-bold text-white capitalize mb-2">{currentPlan}</p>
          {billing?.renewsAt && (
            <p className="text-xs text-slate-gray">
              Renews: {new Date(billing.renewsAt).toLocaleDateString()}
            </p>
          )}
          {billing?.stripe_customer_id && (
            <button onClick={handlePortal}
              className="mt-3 text-xs text-electric-blue hover:underline">
              Manage subscription
            </button>
          )}
        </div>
        <div className="glass rounded-xl p-6">
          <p className="text-sm text-slate-gray mb-1">Usage This Month</p>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-2xl font-bold text-white">
              {billing?.usage?.traces?.toLocaleString() || 0}
            </span>
            <span className="text-sm text-slate-gray">
              / {billing?.usage?.limit == null ? "unlimited" : billing?.usage?.limit?.toLocaleString()} traces
            </span>
          </div>
          {billing?.usage?.limit != null && billing.usage.limit > 0 && (
            <div className="w-full bg-navy-mid rounded-full h-2 mb-2">
              <div
                className="bg-electric-blue rounded-full h-2 transition-all"
                style={{ width: `${Math.min(100, ((billing.usage.traces || 0) / billing.usage.limit) * 100)}%` }}
              />
            </div>
          )}
          <p className="text-xs text-slate-gray">
            Cost this month: ${billing?.usage?.cost_this_month_usd?.toFixed(2) || "0.00"}
          </p>
        </div>
      </div>

      {/* Plan comparison */}
      <h2 className="text-lg font-bold text-white mb-4">Plans</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isUpgrade = PLANS.findIndex((p) => p.id === plan.id) > PLANS.findIndex((p) => p.id === currentPlan);

          return (
            <div
              key={plan.id}
              className={`rounded-xl p-5 flex flex-col ${
                isCurrent
                  ? "glass border-electric-blue/40 shadow-lg shadow-electric-blue/10"
                  : "glass"
              }`}
            >
              {isCurrent && (
                <span className="inline-block mb-2 rounded-full bg-electric-blue/20 border border-electric-blue/40 px-3 py-0.5 text-xs font-semibold text-electric-blue w-fit">
                  Current Plan
                </span>
              )}
              <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
              <div className="mb-3">
                <span className="text-2xl font-bold text-white">{plan.price}</span>
                <span className="text-slate-gray text-sm">{plan.period}</span>
              </div>
              <p className="text-xs text-slate-gray mb-4">{plan.description}</p>
              <ul className="space-y-1.5 mb-5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-xs text-off-white flex items-start gap-1.5">
                    <span className="text-electric-blue mt-0.5">&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="text-center text-xs text-slate-gray py-2">Active</div>
              ) : isUpgrade ? (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    plan.id === "pro"
                      ? "bg-electric-blue text-white hover:bg-electric-blue/90"
                      : "bg-gold text-deep-navy hover:bg-gold/90"
                  }`}
                >
                  Upgrade to {plan.name}
                </button>
              ) : (
                <div className="text-center text-xs text-slate-gray py-2">—</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
