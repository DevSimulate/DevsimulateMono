"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw, CheckCircle, AlertTriangle, ArrowLeft, Zap } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export default function DemoResetPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleReset() {
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch(`${API}/employer/demo/reset`, { method: "POST" });
      const json = await res.json() as { message?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
      setMessage(json.message ?? "Reset complete.");
      setStatus("success");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Reset failed");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#0a0a0a" }}>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
            <Zap size={15} color="white" />
          </div>
          <span className="font-black text-white text-sm tracking-tight">DevSimulate</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full ml-1"
            style={{ background: "#1c1400", color: "#fbbf24", border: "1px solid #713f12" }}>
            DEMO TOOLS
          </span>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: "#111111", border: "1px solid #222222" }}>
          <h1 className="text-xl font-black text-white mb-2">Reset Demo Data</h1>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: "#666666" }}>
            Restores Ahmed Khan, Ali Raza, and Sara Malik with their original NOVA-47 scores.
            Run this before every investor meeting.
          </p>

          {/* Candidates preview */}
          <div className="rounded-xl p-4 mb-6" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#555555" }}>
              WILL RESTORE
            </div>
            {[
              { name: "Ahmed Khan",  score: 82, auth: 94, label: "STRONG YES",  color: "#4ade80" },
              { name: "Ali Raza",    score: 79, auth: 31, label: "NO (flagged)", color: "#f87171" },
              { name: "Sara Malik",  score: 71, auth: 88, label: "YES",          color: "#86efac" },
            ].map(c => (
              <div key={c.name} className="flex items-center justify-between py-2"
                style={{ borderBottom: "1px solid #161616" }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: "#1e1b4b", color: "#818cf8" }}>
                    {c.name.split(" ").map(w => w[0]).join("")}
                  </div>
                  <span className="text-xs font-semibold text-white">{c.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: "#666666" }}>
                    {c.score}/100 · auth {c.auth}
                  </span>
                  <span className="text-xs font-bold" style={{ color: c.color }}>{c.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Status message */}
          {status === "success" && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4"
              style={{ background: "#052e16", border: "1px solid #166534" }}>
              <CheckCircle size={15} color="#4ade80" />
              <span className="text-sm font-medium" style={{ color: "#4ade80" }}>{message}</span>
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4"
              style={{ background: "#1c0000", border: "1px solid #7f1d1d" }}>
              <AlertTriangle size={15} color="#f87171" />
              <span className="text-sm font-medium" style={{ color: "#f87171" }}>{message}</span>
            </div>
          )}

          {/* Reset button */}
          <button
            onClick={handleReset}
            disabled={status === "loading"}
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-bold transition-all text-white"
            style={{
              background: status === "loading"
                ? "#1e1b4b"
                : "linear-gradient(135deg, #6366f1, #4f46e5)",
              opacity: status === "loading" ? 0.7 : 1,
            }}>
            <RefreshCw size={16} className={status === "loading" ? "animate-spin" : ""} />
            {status === "loading" ? "Resetting demo data…" : "Reset Demo Data"}
          </button>

          {status === "success" && (
            <Link href="/employer/dashboard"
              className="block w-full text-center mt-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "#1e1b4b", color: "#818cf8" }}>
              Go to Dashboard →
            </Link>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <Link href="/employer/dashboard"
            className="flex items-center justify-center gap-2 text-xs transition-colors"
            style={{ color: "#444444" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#888888"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#444444"}>
            <ArrowLeft size={12} /> Back to dashboard
          </Link>
          <p className="text-xs mt-2" style={{ color: "#2a2a2a" }}>
            This page is not in the navigation. Access via /employer/demo
          </p>
        </div>
      </div>
    </div>
  );
}
