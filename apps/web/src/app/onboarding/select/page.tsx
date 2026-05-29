"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// ─── Codebase data ────────────────────────────────────────────────────────────

interface CodebaseCard {
  id: string;
  name: string;
  subtitle: string;
  logo: React.ReactNode;
  stack: string;
  difficulties: string[];
  ticketCount: string;
  active: boolean;
  beta?: boolean;
  faang?: boolean;
  href?: string;
}

function DotNetLogo() {
  return (
    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm"
      style={{ background: "#6366f1", color: "#fff", letterSpacing: "-0.5px" }}>
      .NET
    </div>
  );
}
function PythonLogo() {
  return (
    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
      style={{ background: "#FEF3C7" }}>
      🐍
    </div>
  );
}
function NodeLogo() {
  return (
    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs"
      style={{ background: "#CCFBF1", color: "#0D9488" }}>
      Node.js
    </div>
  );
}
function ReactLogo() {
  return (
    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
      style={{ background: "#DBEAFE" }}>
      ⚛️
    </div>
  );
}
function PyGoLogo() {
  return (
    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs"
      style={{ background: "#F3E8FF", color: "#7C3AED", lineHeight: 1.2, textAlign: "center" }}>
      Py<br />Go
    </div>
  );
}

const CARDS: CodebaseCard[] = [
  {
    id: "novatech",
    name: "NovaTech CRM",
    subtitle: "Enterprise order management system",
    logo: <DotNetLogo />,
    stack: ".NET 8",
    difficulties: ["MID", "SENIOR"],
    ticketCount: "8 tickets available",
    active: true,
    href: "/onboarding/guide?codebase=novatech",
  },
  {
    id: "ragcore",
    name: "RAGCore",
    subtitle: "AI document Q&A system",
    logo: <PythonLogo />,
    stack: "Python + LangChain",
    difficulties: ["MID"],
    ticketCount: "Coming soon",
    active: false,
    beta: true,
  },
  {
    id: "techcorp-hrm",
    name: "TechCorp HRM",
    subtitle: "HR management platform",
    logo: <NodeLogo />,
    stack: "Node.js + TypeScript",
    difficulties: ["MID", "SENIOR"],
    ticketCount: "Coming soon",
    active: false,
  },
  {
    id: "shopfront",
    name: "ShopFront",
    subtitle: "E-commerce platform",
    logo: <ReactLogo />,
    stack: "React + TypeScript",
    difficulties: ["MID"],
    ticketCount: "Coming soon",
    active: false,
  },
  {
    id: "searchcore",
    name: "SearchCore",
    subtitle: "FAANG-style search system",
    logo: <PyGoLogo />,
    stack: "Python + Go",
    difficulties: ["SENIOR"],
    ticketCount: "Coming soon",
    active: false,
    faang: true,
  },
];

const DIFF_STYLE: Record<string, { bg: string; color: string }> = {
  MID:    { bg: "#FEF3C7", color: "#D97706" },
  SENIOR: { bg: "#FCE7F3", color: "#BE185D" },
  JUNIOR: { bg: "#CCFBF1", color: "#0D9488" },
};

// ─── Notify-me modal ──────────────────────────────────────────────────────────

function NotifyModal({
  codebaseName,
  onClose,
}: {
  codebaseName: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");
    try {
      await axios.post(`${API_URL}/waitlist`, { email: email.trim(), codebase: codebaseName });
      setState("done");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErrorMsg(msg ?? "Something went wrong. Try again.");
      setState("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card rounded-2xl p-8 w-full max-w-sm relative" style={{ background: "#fff" }}>
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-xl leading-none transition-opacity hover:opacity-60"
          style={{ color: "#6B6B6B" }}
          aria-label="Close"
        >
          ×
        </button>

        {state === "done" ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="font-black text-xl mb-2" style={{ color: "#1A1A1A" }}>You're on the list!</h3>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "#6B6B6B" }}>
              We'll email you the moment <strong>{codebaseName}</strong> launches.
            </p>
            <button onClick={onClose} className="btn-primary w-full">Done</button>
          </div>
        ) : (
          <>
            <div className="text-2xl mb-3">🔔</div>
            <h3 className="font-black text-lg mb-1" style={{ color: "#1A1A1A" }}>
              Get notified when {codebaseName} launches
            </h3>
            <p className="text-sm mb-5" style={{ color: "#6B6B6B" }}>
              We'll send one email — no spam, no drip sequences.
            </p>

            <form onSubmit={submit} className="space-y-3">
              <input
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all"
                style={{
                  borderColor: "#E4E2DD",
                  background: "#F7F6F3",
                  color: "#1A1A1A",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "#5B5BD6")}
                onBlur={e => (e.currentTarget.style.borderColor = "#E4E2DD")}
              />
              {state === "error" && (
                <p className="text-xs" style={{ color: "#BE185D" }}>{errorMsg}</p>
              )}
              <button
                type="submit"
                disabled={state === "loading"}
                className="btn-primary w-full"
              >
                {state === "loading" ? "Saving…" : "Notify me →"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SelectCodebasePage() {
  const router = useRouter();
  const [notifyTarget, setNotifyTarget] = useState<string | null>(null);

  return (
    <main className="bg-grid min-h-screen" style={{ background: "#F7F6F3" }}>

      {/* Beta banner */}
      <div className="w-full px-4 py-3 text-center text-sm font-medium"
        style={{ background: "#FEF9C3", borderBottom: "1px solid #FDE68A", color: "#92400E" }}>
        🚧 DevSim is in beta — NovaTech CRM is live now. More codebases dropping soon.
        Your feedback shapes what we build next.
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-40 nav-glass px-6 py-3.5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 group">
          <span className="text-xl">⚡</span>
          <span className="font-black text-lg tracking-tight" style={{ color: "#1A1A1A" }}>DevSimulate</span>
        </a>
        <a href="/dashboard" className="text-sm font-medium transition-colors"
          style={{ color: "#6B6B6B" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
          onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}>
          Dashboard
        </a>
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">

          {CARDS.map((card, i) => (
            <div
              key={card.id}
              className={`fade-in-up relative rounded-2xl flex flex-col overflow-hidden transition-all duration-200 ${card.active ? "cursor-pointer" : ""}`}
              style={{
                background: "#fff",
                border: card.active ? "2px solid #22c55e" : "1px solid #E4E2DD",
                boxShadow: card.active ? "0 0 0 3px rgba(34,197,94,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
                animationDelay: `${i * 60}ms`,
              }}
              onClick={() => { if (card.active && card.href) router.push(card.href); }}
              onMouseEnter={e => {
                if (card.active) {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.10), 0 0 0 3px rgba(34,197,94,0.20)";
                }
              }}
              onMouseLeave={e => {
                if (card.active) {
                  (e.currentTarget as HTMLDivElement).style.transform = "";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px rgba(34,197,94,0.12)";
                }
              }}
            >
              {/* Corner badges */}
              {card.beta && (
                <span className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full z-10"
                  style={{ background: "#CCFBF1", color: "#0D9488" }}>
                  Beta
                </span>
              )}
              {card.faang && (
                <span className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full z-10"
                  style={{ background: "#EBEBFF", color: "#5B5BD6" }}>
                  FAANG Prep
                </span>
              )}
              {card.active && (
                <span className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full z-10 flex items-center gap-1"
                  style={{ background: "#DCFCE7", color: "#16a34a" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  Live
                </span>
              )}

              {/* Card body */}
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-start gap-3 mb-4">
                  {card.logo}
                  <div>
                    <h3 className="font-black text-base leading-tight" style={{ color: "#1A1A1A" }}>
                      {card.name}
                    </h3>
                    <p className="text-xs mt-0.5 leading-snug" style={{ color: "#6B6B6B" }}>
                      {card.subtitle}
                    </p>
                  </div>
                </div>

                {/* Stack badge */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                    style={{ background: "#EBEBFF", color: "#5B5BD6" }}>
                    {card.stack}
                  </span>
                  {card.difficulties.map(d => (
                    <span key={d} className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ background: DIFF_STYLE[d]?.bg, color: DIFF_STYLE[d]?.color }}>
                      {d}
                    </span>
                  ))}
                </div>

                {/* Ticket count */}
                <p className="text-xs font-medium mb-5 flex items-center gap-1.5"
                  style={{ color: card.active ? "#16a34a" : "#9CA3AF" }}>
                  {card.active ? "🎫" : "⏳"} {card.ticketCount}
                </p>

                {/* Spacer */}
                <div className="flex-1" />

                {/* CTA button */}
                {card.active ? (
                  <button
                    onClick={e => { e.stopPropagation(); router.push(card.href!); }}
                    className="btn-primary w-full text-sm text-center"
                  >
                    Start with {card.name.split(" ")[0]} →
                  </button>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setNotifyTarget(card.name); }}
                    className="btn-outline w-full text-sm text-center"
                  >
                    Notify me when live
                  </button>
                )}
              </div>

              {/* Coming soon overlay */}
              {!card.active && (
                <div className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ background: "rgba(247,246,243,0.55)" }} />
              )}
            </div>
          ))}

          {/* Placeholder card */}
          <div
            className="fade-in-up rounded-2xl flex flex-col items-center justify-center p-8 text-center"
            style={{
              border: "2px dashed #E4E2DD",
              background: "transparent",
              minHeight: "220px",
              animationDelay: `${CARDS.length * 60}ms`,
            }}
          >
            <div className="text-3xl mb-3">🗳️</div>
            <h3 className="font-bold text-base mb-1" style={{ color: "#1A1A1A" }}>
              More stacks coming
            </h3>
            <p className="text-sm mb-5" style={{ color: "#9CA3AF" }}>
              Vote for what you want next
            </p>
            <a
              href="https://forms.gle/devsimulatevote"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline text-sm"
            >
              Vote →
            </a>
          </div>

        </div>

        {/* Bottom note */}
        <p className="text-center text-sm" style={{ color: "#9CA3AF" }}>
          More codebases are being built right now. All free during beta.
        </p>
      </div>

      {/* Notify-me modal */}
      {notifyTarget && (
        <NotifyModal
          codebaseName={notifyTarget}
          onClose={() => setNotifyTarget(null)}
        />
      )}
    </main>
  );
}
