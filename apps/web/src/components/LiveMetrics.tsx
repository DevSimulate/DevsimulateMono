"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Users, Code2, Award } from "lucide-react";

const METRICS = [
  { icon: Users, label: "Developers", value: 1247, suffix: "+" },
  { icon: Code2, label: "Tickets Solved", value: 3891, suffix: "" },
  { icon: Award, label: "Avg Score", value: 78, suffix: "/100" },
  { icon: TrendingUp, label: "This Week", value: 156, suffix: " tickets" },
];

export function LiveMetrics() {
  const [counts, setCounts] = useState(METRICS.map(() => 0));
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    
    // Animate counters
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;

    const timers = METRICS.map((metric, index) => {
      let current = 0;
      return setInterval(() => {
        current += metric.value / steps;
        if (current >= metric.value) {
          setCounts(prev => {
            const newCounts = [...prev];
            newCounts[index] = metric.value;
            return newCounts;
          });
          clearInterval(timers[index]);
        } else {
          setCounts(prev => {
            const newCounts = [...prev];
            newCounts[index] = Math.floor(current);
            return newCounts;
          });
        }
      }, interval);
    });

    return () => timers.forEach(timer => clearInterval(timer));
  }, []);

  return (
    <div className={`mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto transition-all duration-1000 ${
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
    }`}>
      {METRICS.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div
            key={metric.label}
            className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-4 text-center hover:border-brand-500/50 transition-colors"
          >
            <Icon className="w-5 h-5 text-brand-400 mx-auto mb-2" />
            <div className="text-2xl font-black text-white">
              {counts[index].toLocaleString()}
              <span className="text-sm font-normal text-slate-500">{metric.suffix}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">{metric.label}</div>
          </div>
        );
      })}
    </div>
  );
}
