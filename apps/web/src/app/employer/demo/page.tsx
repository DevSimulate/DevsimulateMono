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
      style={{ background: "#f5f6f8" }}>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #4f46e5, #4338ca)" }}>
            <Zap size={15} color="white" />
          </div>
          <span className="font-black text-[#131722] text-sm tracking-tight">DevSimulate</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full ml-1"
            style={{ background: "#1c1400", color: "#b54708", border: "1px solid #713f12" }}>
            DEMO TOOLS
          </span>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>
          <h1 className="text-xl font-black text-[#131722] mb-2">Reset Demo Data</h1>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: "#8a93a3" }}>
            Restores Ahmed Khan, Ali Raza, and Sara Malik with their original NOVA-47 scores.
            Run this before every investor meeting.
          </p>

          {/* Candidates preview */}
          <div className="rounded-xl p-4 mb-6" style={{ background: "#f2f4f7", border: "1px solid #eef1f5" }}>
            <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#8a93a3" }}>
              WILL RESTORE
            </div>
            {[
              { name: "Ahmed Khan",  score: 82, auth: 94, label: "STRONG YES",  color: "#067647" },
              { name: "Ali Raza",    score: 79, auth: 31, label: "NO (flagged)", color: "#b42318" },
              { name: "Sara Malik",  score: 71, auth: 88, label: "YES",          color: "#86efac" },
            ].map(c => (
              <div key={c.name} className="flex items-center justify-between py-2"
                style={{ borderBottom: "1px solid #eef1f5" }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: "#eef0fd", color: "#4338ca" }}>
                    {c.name.split(" ").map(w => w[0]).join("")}
                  </div>
                  <span className="text-xs font-semibold text-[#131722]">{c.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: "#8a93a3" }}>
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
              style={{ background: "#ecfdf3", border: "1px solid #a7d8bd" }}>
              <CheckCircle size={15} color="#067647" />
              <span className="text-sm font-medium" style={{ color: "#067647" }}>{message}</span>
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4"
              style={{ background: "#1c0000", border: "1px solid #7f1d1d" }}>
              <AlertTriangle size={15} color="#b42318" />
              <span className="text-sm font-medium" style={{ color: "#b42318" }}>{message}</span>
            </div>
          )}

          {/* Reset button */}
          <button
            onClick={handleReset}
            disabled={status === "loading"}
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-bold transition-all text-[#131722]"
            style={{
              background: status === "loading"
                ? "#eef0fd"
                : "linear-gradient(135deg, #4f46e5, #4338ca)",
              opacity: status === "loading" ? 0.7 : 1,
            }}>
            <RefreshCw size={16} className={status === "loading" ? "animate-spin" : ""} />
            {status === "loading" ? "Resetting demo data…" : "Reset Demo Data"}
          </button>

          {status === "success" && (
            <Link href="/employer/dashboard"
              className="block w-full text-center mt-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "#eef0fd", color: "#4338ca" }}>
              Go to Dashboard →
            </Link>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <Link href="/employer/dashboard"
            className="flex items-center justify-center gap-2 text-xs transition-colors"
            style={{ color: "#9aa3b2" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#5a6472"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#9aa3b2"}>
            <ArrowLeft size={12} /> Back to dashboard
          </Link>
          <p className="text-xs mt-2" style={{ color: "#d5d9e0" }}>
            This page is not in the navigation. Access via /employer/demo
          </p>
        </div>
      </div>
    </div>
  );
}
