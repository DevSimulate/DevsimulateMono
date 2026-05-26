"use client";

import { Check } from "lucide-react";

const PRICING_TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for trying out DevSimulate",
    features: [
      "3 tickets per month",
      "JUNIOR + MID difficulty",
      "Basic AI feedback",
      "Community support",
      "Public profile"
    ],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "per month",
    description: "For serious developers leveling up",
    features: [
      "Unlimited tickets",
      "All difficulty levels",
      "Detailed AI feedback",
      "Priority support",
      "Downloadable certificates",
      "Progress analytics",
      "Private profile option"
    ],
    cta: "Start Pro Trial",
    highlighted: true,
  },
  {
    name: "Company",
    price: "$99",
    period: "per seat/month",
    description: "For teams and bootcamps",
    features: [
      "Everything in Pro",
      "Team analytics dashboard",
      "Custom codebases",
      "SSO integration",
      "Dedicated support",
      "Bulk licensing",
      "API access"
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section className="py-20 px-6 border-t border-slate-800">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Start free, upgrade when you're ready. No credit card required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl border p-8 transition-all hover:scale-105 ${
                tier.highlighted
                  ? 'border-brand-500 bg-gradient-to-br from-brand-950/50 to-purple-950/50 shadow-xl shadow-brand-500/20'
                  : 'border-slate-800 bg-slate-900'
              }`}
            >
              {tier.highlighted && (
                <div className="inline-block px-3 py-1 rounded-full bg-brand-500 text-white text-xs font-semibold mb-4">
                  Most Popular
                </div>
              )}
              
              <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
              <p className="text-sm text-slate-400 mb-6">{tier.description}</p>
              
              <div className="mb-6">
                <span className="text-4xl font-black text-white">{tier.price}</span>
                <span className="text-slate-400 text-sm ml-2">{tier.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className={`w-5 h-5 flex-shrink-0 ${
                      tier.highlighted ? 'text-brand-400' : 'text-emerald-400'
                    }`} />
                    <span className="text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full rounded-lg px-6 py-3 font-semibold transition-colors ${
                  tier.highlighted
                    ? 'bg-brand-500 text-white hover:bg-brand-600'
                    : 'border-2 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-slate-500">
            All plans include access to our VS Code extension and GitHub integration.
            <br />
            Need a custom plan? <a href="mailto:hello@devsimulate.io" className="text-brand-400 hover:text-brand-300 underline">Contact us</a>
          </p>
        </div>
      </div>
    </section>
  );
}
