"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";

// ─── Codebase data ────────────────────────────────────────────────────────────

const DIFF_STYLE: Record<string, { bg: string; color: string }> = {
  MID:    { bg: "#FEF3C7", color: "#D97706" },
  SENIOR: { bg: "#FCE7F3", color: "#BE185D" },
  JUNIOR: { bg: "#CCFBF1", color: "#0D9488" },
};

interface Card {
  id: string;
  name: string;
  subtitle: string;
  logoLabel: string;
  logoBg: string;
  logoColor: string;
  stack: string;
  difficulties: string[];
  ticketCount: string;
  active: boolean;
  cornerBadge?: { label: string; bg: string; color: string };
  href?: string;
}

const CARDS: Card[] = [
  {
    id: "system-design",
    name: "System Design Arena",
    subtitle: "FAANG-style architecture challenges",
    logoLabel: "SD",
    logoBg: "#EBEBFF",
    logoColor: "#5B5BD6",
    stack: "Architecture",
    difficulties: ["JUNIOR", "MID", "SENIOR"],
    ticketCount: "10 tickets available",
    active: true,
    cornerBadge: { label: "● New", bg: "#EBEBFF", color: "#5B5BD6" },
    href: "/tickets",
  },
  {
    id: "novatech",
    name: "NovaTech CRM",
    subtitle: "Enterprise order management system",
    logoLabel: ".NET",
    logoBg: "#6366f1",
    logoColor: "#fff",
    stack: ".NET 8",
    difficulties: ["JUNIOR", "MID", "SENIOR"],
    ticketCount: "17 tickets available",
    active: true,
    cornerBadge: { label: "● Live", bg: "#DCFCE7", color: "#16a34a" },
    href: "/onboarding/guide?codebase=novatech",
  },
  {
    id: "ragcore",
    name: "RAGCore",
    subtitle: "AI document Q&A system",
    logoLabel: "🐍",
    logoBg: "#FEF3C7",
    logoColor: "#92400E",
    stack: "Python + LangChain",
    difficulties: ["JUNIOR", "MID"],
    ticketCount: "15 tickets available",
    active: true,
    cornerBadge: { label: "● New", bg: "#FEF3C7", color: "#92400E" },
    href: "/tickets",
  },
  {
    id: "techcorp",
    name: "TechCorp HRM",
    subtitle: "HR management platform",
    logoLabel: "JS",
    logoBg: "#CCFBF1",
    logoColor: "#0D9488",
    stack: "Node.js + TypeScript",
    difficulties: ["MID", "SENIOR"],
    ticketCount: "Coming soon",
    active: false,
  },
  {
    id: "shopfront",
    name: "ShopFront",
    subtitle: "E-commerce platform",
    logoLabel: "⚛️",
    logoBg: "#DBEAFE",
    logoColor: "#1D4ED8",
    stack: "React + TypeScript",
    difficulties: ["MID"],
    ticketCount: "Coming soon",
    active: false,
  },
  {
    id: "searchcore",
    name: "SearchCore",
    subtitle: "FAANG-style search system",
    logoLabel: "Go",
    logoBg: "#F3E8FF",
    logoColor: "#7C3AED",
    stack: "Python + Go",
    difficulties: ["SENIOR"],
    ticketCount: "Coming soon",
    active: false,
    cornerBadge: { label: "FAANG Prep", bg: "#EBEBFF", color: "#5B5BD6" },
  },
  {
    id: "placeholder",
    name: "More stacks coming",
    subtitle: "Vote for what you want next",
    logoLabel: "?",
    logoBg: "#F3F4F6",
    logoColor: "#9CA3AF",
    stack: "",
    difficulties: [],
    ticketCount: "",
    active: false,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SelectCodebasePage() {
  const router = useRouter();

  return (
    <main className="bg-grid min-h-screen" style={{ background: "#F7F6F3" }}>

      {/* Beta banner */}
      <div className="w-full px-4 py-3 text-center text-sm font-medium"
        style={{ background: "#FEF9C3", borderBottom: "1px solid #FDE68A", color: "#92400E" }}>
        🚧 DevSim is in beta — System Design Arena, NovaTech CRM, and RAGCore are live now. More codebases dropping soon.
        Your feedback shapes what we build next.
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-40 nav-glass px-6 py-3.5 flex items-center justify-between">
        <Link href="/"><Logo variant="horizontal" size={32} /></Link>
        <Link href="/dashboard" className="text-sm font-medium transition-colors"
          style={{ color: "#6B6B6B" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
          onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}>
          Dashboard
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto px-5 py-14">

        {/* Header */}
        <div className="text-center mb-12 fade-in-up">
          <div className="section-label mb-4">Start here</div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3" style={{ color: "#1A1A1A" }}>
            Choose your codebase
          </h1>
          <p className="text-lg max-w-md mx-auto" style={{ color: "#6B6B6B" }}>
            Pick the stack you work with. More coming soon.
          </p>
        </div>

        {/* Card grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CARDS.map((card, i) => {
            const isPlaceholder = card.id === "placeholder";

            if (isPlaceholder) {
              return (
                <div key={card.id}
                  className="fade-in-up rounded-2xl flex flex-col items-center justify-center p-8 text-center"
                  style={{
                    border: "2px dashed #E4E2DD",
                    background: "transparent",
                    minHeight: "220px",
                    animationDelay: `${i * 60}ms`,
                  }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4"
                    style={{ background: "#F3F4F6", color: "#9CA3AF", fontWeight: 900 }}>
                    ?
                  </div>
                  <h3 className="font-bold text-base mb-1" style={{ color: "#1A1A1A" }}>More stacks coming</h3>
                  <p className="text-sm" style={{ color: "#9CA3AF" }}>Vote for what you want next</p>
                </div>
              );
            }

            return (
              <div
                key={card.id}
                className={`fade-in-up relative rounded-2xl flex flex-col overflow-hidden transition-all duration-200 ${card.active ? "cursor-pointer" : ""}`}
                style={{
                  background: "#fff",
                  border: card.active
                    ? card.id === "system-design" ? "2px solid #5B5BD6"
                    : card.id === "ragcore" ? "2px solid #D97706"
                    : "2px solid #22c55e"
                    : "1px solid #E4E2DD",
                  boxShadow: card.active
                    ? card.id === "system-design" ? "0 0 0 3px rgba(91,91,214,0.12)"
                    : card.id === "ragcore" ? "0 0 0 3px rgba(217,119,6,0.12)"
                    : "0 0 0 3px rgba(34,197,94,0.12)"
                    : "0 1px 3px rgba(0,0,0,0.04)",
                  animationDelay: `${i * 60}ms`,
                }}
                onClick={() => { if (card.active && card.href) router.push(card.href); }}
                onMouseEnter={e => {
                  if (card.active) {
                    const shadow = card.id === "system-design"
                      ? "0 8px 24px rgba(0,0,0,0.10), 0 0 0 3px rgba(91,91,214,0.25)"
                      : card.id === "ragcore"
                      ? "0 8px 24px rgba(0,0,0,0.10), 0 0 0 3px rgba(217,119,6,0.25)"
                      : "0 8px 24px rgba(0,0,0,0.10), 0 0 0 3px rgba(34,197,94,0.20)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = shadow;
                  }
                }}
                onMouseLeave={e => {
                  if (card.active) {
                    const shadow = card.id === "system-design"
                      ? "0 0 0 3px rgba(91,91,214,0.12)"
                      : card.id === "ragcore"
                      ? "0 0 0 3px rgba(217,119,6,0.12)"
                      : "0 0 0 3px rgba(34,197,94,0.12)";
                    (e.currentTarget as HTMLDivElement).style.transform = "";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = shadow;
                  }
                }}
              >
                {/* Corner badge */}
                {card.cornerBadge && (
                  <span className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full z-10"
                    style={{ background: card.cornerBadge.bg, color: card.cornerBadge.color }}>
                    {card.cornerBadge.label}
                  </span>
                )}

                <div className="p-6 flex-1 flex flex-col">
                  {/* Logo + name */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                      style={{ background: card.logoBg, color: card.logoColor }}>
                      {card.logoLabel}
                    </div>
                    <div>
                      <h3 className="font-black text-base leading-tight" style={{ color: "#1A1A1A" }}>
                        {card.name}
                      </h3>
                      <p className="text-xs mt-0.5 leading-snug" style={{ color: "#6B6B6B" }}>
                        {card.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {card.stack && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{ background: "#EBEBFF", color: "#5B5BD6" }}>
                        {card.stack}
                      </span>
                    )}
                    {card.difficulties.map(d => (
                      <span key={d} className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{ background: DIFF_STYLE[d]?.bg, color: DIFF_STYLE[d]?.color }}>
                        {d}
                      </span>
                    ))}
                  </div>

                  {/* Ticket count */}
                  {card.ticketCount && (
                    <p className="text-xs font-medium mb-5 flex items-center gap-1.5"
                      style={{ color: card.active ? "#16a34a" : "#9CA3AF" }}>
                      {card.active ? "🎫" : "⏳"} {card.ticketCount}
                    </p>
                  )}

                  <div className="flex-1" />

                  {/* CTA — only on active card */}
                  {card.active && (
                    <button
                      onClick={e => { e.stopPropagation(); router.push(card.href!); }}
                      className="btn-primary w-full text-sm text-center"
                    >
                      Start with {card.name} →
                    </button>
                  )}

                  {/* Coming soon label — no button */}
                  {!card.active && card.ticketCount && (
                    <div className="text-xs font-semibold text-center py-2 rounded-xl"
                      style={{ background: "#F7F6F3", color: "#9CA3AF" }}>
                      Coming soon
                    </div>
                  )}
                </div>

                {/* Coming soon overlay */}
                {!card.active && (
                  <div className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{ background: "rgba(247,246,243,0.55)" }} />
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm mt-8" style={{ color: "#9CA3AF" }}>
          All codebases are free during beta.
        </p>
      </div>
    </main>
  );
}
