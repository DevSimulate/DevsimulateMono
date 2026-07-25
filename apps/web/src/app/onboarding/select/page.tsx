"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Badge, BadgeTone } from "@/components/ui/Badge";

// ─── Codebase data ────────────────────────────────────────────────────────────

const DIFF_TONE: Record<string, BadgeTone> = { JUNIOR: "good", MID: "warn", SENIOR: "neutral" };

interface Card {
  id: string;
  name: string;
  subtitle: string;
  logoLabel: string;
  logoBg: string;
  logoColor: string;
  stack: string;
  stackKey?: string;
  difficulties: string[];
  ticketCount: string;
  active: boolean;
  cornerBadge?: { label: string; tone: BadgeTone };
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
    cornerBadge: { label: "New", tone: "neutral" },
    stackKey: "SYSTEM_DESIGN",
    href: "/tickets?stack=SYSTEM_DESIGN",
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
    cornerBadge: { label: "Live", tone: "good" },
    stackKey: "DOTNET",
    href: "/tickets?stack=DOTNET",
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
    cornerBadge: { label: "New", tone: "neutral" },
    stackKey: "PYTHON",
    href: "/tickets?codebaseId=ragcore-seed-id-001",
  },
  {
    id: "techcorp",
    name: "TechCorp HRM",
    subtitle: "HR management platform",
    logoLabel: "TS",
    logoBg: "#DBEAFE",
    logoColor: "#1D4ED8",
    stack: "Node.js + TypeScript",
    stackKey: "NODE",
    difficulties: ["JUNIOR", "MID", "SENIOR"],
    ticketCount: "15 tickets available",
    active: true,
    cornerBadge: { label: "New", tone: "neutral" },
    href: "/tickets?stack=NODE",
  },
  {
    id: "shopfront",
    name: "ShopFront",
    subtitle: "React e-commerce storefront",
    logoLabel: "⚛",
    logoBg: "#E0F2FE",
    logoColor: "#0369A1",
    stack: "React + TypeScript",
    stackKey: "REACT",
    difficulties: ["JUNIOR", "MID", "SENIOR"],
    ticketCount: "15 tickets available",
    active: true,
    cornerBadge: { label: "New", tone: "neutral" },
    href: "/tickets?stack=REACT",
  },
  {
    id: "dataforge",
    name: "DataForge",
    subtitle: "Kafka + Spark data pipeline",
    logoLabel: "⚡",
    logoBg: "#FFF7ED",
    logoColor: "#C2410C",
    stack: "Python + Kafka + Spark",
    stackKey: "PYTHON",
    difficulties: ["JUNIOR", "MID", "SENIOR"],
    ticketCount: "15 tickets available",
    active: true,
    cornerBadge: { label: "New", tone: "neutral" },
    href: "/tickets?codebaseId=dataforge-seed-id-001",
  },
  {
    id: "infracore",
    name: "InfraCore",
    subtitle: "Terraform + Kubernetes infrastructure platform",
    logoLabel: "⚙",
    logoBg: "#ECFDF5",
    logoColor: "#065F46",
    stack: "Terraform + Kubernetes",
    stackKey: "DEVOPS",
    difficulties: ["JUNIOR", "MID", "SENIOR"],
    ticketCount: "15 tickets available",
    active: true,
    cornerBadge: { label: "New", tone: "neutral" },
    href: "/tickets?codebaseId=infracore-seed-id-001",
  },
  {
    id: "matchcore",
    name: "MatchCore",
    subtitle: "Low-latency order matching engine",
    logoLabel: "C++",
    logoBg: "#1E293B",
    logoColor: "#fff",
    stack: "C++17",
    stackKey: "CPP",
    difficulties: ["JUNIOR", "MID", "SENIOR"],
    ticketCount: "15 tickets available",
    active: true,
    cornerBadge: { label: "New", tone: "neutral" },
    href: "/tickets?codebaseId=matchcore-seed-id-001",
  },
  {
    id: "meridian-globeview",
    name: "Meridian GlobeView",
    subtitle: "3D map & terrain rendering engine",
    logoLabel: "🌍",
    logoBg: "#E0F2FE",
    logoColor: "#0369A1",
    stack: "C++17 + OpenGL",
    stackKey: "CPP",
    difficulties: ["JUNIOR", "MID", "SENIOR"],
    ticketCount: "11 tickets available",
    active: true,
    cornerBadge: { label: "New", tone: "neutral" },
    href: "/tickets?codebaseId=meridian-globeview-seed-id-001",
  },
  {
    id: "finserve",
    name: "FinServe",
    subtitle: "Spring Boot payments & ledger service",
    logoLabel: "☕",
    logoBg: "#FEE2E2",
    logoColor: "#B91C1C",
    stack: "Java 17 + Spring Boot",
    stackKey: "JAVA",
    difficulties: ["JUNIOR", "MID", "SENIOR"],
    ticketCount: "15 tickets available",
    active: true,
    cornerBadge: { label: "New", tone: "neutral" },
    href: "/tickets?codebaseId=finserve-seed-id-001",
  },
  {
    id: "pulsedash",
    name: "PulseDash",
    subtitle: "Angular real-time admin dashboard",
    logoLabel: "A",
    logoBg: "#FEE2E2",
    logoColor: "#DD0031",
    stack: "Angular 17",
    stackKey: "ANGULAR",
    difficulties: ["JUNIOR", "MID", "SENIOR"],
    ticketCount: "15 tickets available",
    active: true,
    cornerBadge: { label: "New", tone: "neutral" },
    href: "/tickets?codebaseId=pulsedash-seed-id-001",
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
    cornerBadge: { label: "FAANG prep", tone: "neutral" },
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

  function navigate(card: Card) {
    if (!card.active || !card.href) return;
    if (card.stackKey) localStorage.setItem("ds_selected_stack", card.stackKey);
    const guideUrl = `/onboarding/guide${card.href.includes("codebaseId") ? `?codebaseId=${card.href.split("codebaseId=")[1]}` : ""}`;
    const seen = localStorage.getItem("ds_guide_seen");
    router.push(seen ? card.href : guideUrl);
  }

  return (
    <main className="min-h-screen bg-paper text-ink">

      {/* Beta banner */}
      <div className="w-full px-4 py-3 text-center text-sm font-medium border-b border-hairline" style={{ background: "var(--signal-amber-weak)", color: "var(--signal-amber)" }}>
        DevSim is in beta — System Design Arena, NovaTech CRM, RAGCore, TechCorp HRM, ShopFront, DataForge, and InfraCore are live now. More codebases dropping soon.
        Your feedback shapes what we build next.
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-surface border-b border-hairline px-6 py-3.5 flex items-center justify-between">
        <Link href="/"><Logo variant="horizontal" size={30} /></Link>
        <Link href="/dashboard" className="text-sm font-medium text-muted hover:text-ink transition-colors duration-150">Dashboard</Link>
      </nav>

      <div className="max-w-5xl mx-auto px-5 py-14">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-3">Start here</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight mb-3">Choose your codebase</h1>
          <p className="text-base text-muted max-w-md mx-auto">Pick the stack you work with. More coming soon.</p>
        </div>

        {/* Card grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CARDS.map((card) => {
            const isPlaceholder = card.id === "placeholder";

            if (isPlaceholder) {
              return (
                <div key={card.id} className="rounded border-2 border-dashed border-hairline flex flex-col items-center justify-center p-8 text-center" style={{ minHeight: "220px" }}>
                  <div className="w-11 h-11 rounded flex items-center justify-center text-xl mb-4 bg-paper text-muted font-bold">?</div>
                  <h3 className="font-semibold text-base mb-1">{card.name}</h3>
                  <p className="text-sm text-muted">{card.subtitle}</p>
                </div>
              );
            }

            return (
              <div
                key={card.id}
                className={`relative rounded border bg-surface flex flex-col overflow-hidden transition-colors duration-150 ${card.active ? "cursor-pointer border-hairline hover:border-emerald" : "border-hairline"}`}
                onClick={() => navigate(card)}
              >
                {/* Corner badge */}
                {card.cornerBadge && (
                  <Badge tone={card.cornerBadge.tone} className="absolute top-3 right-3 z-10">{card.cornerBadge.label}</Badge>
                )}

                <div className="p-6 flex-1 flex flex-col">
                  {/* Logo + name */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-11 h-11 rounded flex items-center justify-center font-bold text-sm shrink-0"
                      style={{ background: card.logoBg, color: card.logoColor }}>
                      {card.logoLabel}
                    </div>
                    <div>
                      <h3 className="font-semibold text-base leading-tight">{card.name}</h3>
                      <p className="text-xs mt-0.5 leading-snug text-muted">{card.subtitle}</p>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {card.stack && <Badge tone="neutral">{card.stack}</Badge>}
                    {card.difficulties.map((d) => (
                      <Badge key={d} tone={DIFF_TONE[d]}>{d[0] + d.slice(1).toLowerCase()}</Badge>
                    ))}
                  </div>

                  {/* Ticket count */}
                  {card.ticketCount && (
                    <p className={`text-xs font-medium mb-5 ${card.active ? "text-emerald" : "text-muted"}`}>{card.ticketCount}</p>
                  )}

                  <div className="flex-1" />

                  {/* CTA — only on active card */}
                  {card.active && (
                    <Button variant="primary" className="w-full" onClick={(e) => { e.stopPropagation(); navigate(card); }}>
                      Start with {card.name} →
                    </Button>
                  )}

                  {/* Coming soon label — no button */}
                  {!card.active && card.ticketCount && (
                    <div className="text-xs font-semibold text-center py-2 rounded bg-paper text-muted">Coming soon</div>
                  )}
                </div>

                {/* Coming soon overlay */}
                {!card.active && <div className="absolute inset-0 rounded pointer-events-none bg-[rgba(247,246,243,0.55)]" />}
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm mt-8 text-muted">All codebases are free during beta.</p>
      </div>
    </main>
  );
}
