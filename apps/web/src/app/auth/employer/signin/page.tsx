"use client";

import { useState } from "react";
import { storeToken } from "@/lib/auth";
import { BoltIcon } from "@/components/Logo";
import { Mail, Check } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export default function EmployerSignInPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Test-login bypass (remove after testing)
  const [showTest, setShowTest] = useState(false);
  const [testCode, setTestCode] = useState("");

  async function sendLink() {
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError("Enter a valid email"); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API}/auth/employer/magic-link`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to send");
      setSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function testLogin() {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch(`${API}/auth/employer/test-login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || "test@lmkr.com", code: testCode }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Invalid test login");
      storeToken(j.data.token);
      window.location.href = j.data.hasOrg ? "/employer/dashboard" : "/employer/signup";
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0a0a0a" }}>
      <div className="max-w-md w-full rounded-2xl p-8" style={{ background: "#111111", border: "1px solid #222222" }}>
        <div className="flex items-center gap-2 mb-6">
          <BoltIcon size={28} /><span className="font-black text-white">DevSimulate</span>
        </div>
        <div className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block mb-4"
          style={{ background: "#1e1b4b", color: "#818cf8" }}>Employer Portal</div>

        {sent ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#052e16" }}>
              <Check size={28} style={{ color: "#4ade80" }} />
            </div>
            <h1 className="text-xl font-black text-white mb-1">Check your inbox</h1>
            <p className="text-sm" style={{ color: "#888" }}>
              We sent a sign-in link to <span className="text-white font-semibold">{email}</span>. Click it to continue. It expires in 15 minutes.
            </p>
            <button onClick={() => setSent(false)} className="text-xs mt-4" style={{ color: "#818cf8" }}>Use a different email</button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black text-white mb-1">Sign in to hire</h1>
            <p className="text-sm mb-6" style={{ color: "#888" }}>
              No GitHub needed — we'll email you a secure sign-in link.
            </p>

            {error && <div className="rounded-lg px-3 py-2 mb-4 text-xs" style={{ background: "#1c0000", color: "#f87171" }}>{error}</div>}

            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>Work email</label>
            <div className="flex items-center gap-2 rounded-lg px-3 mb-4" style={{ background: "#0d0d0d", border: "1px solid #2a2a2a" }}>
              <Mail size={15} style={{ color: "#555" }} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
                onKeyDown={(e) => e.key === "Enter" && sendLink()}
                className="flex-1 bg-transparent py-2.5 text-sm outline-none" style={{ color: "#e5e7eb" }} />
            </div>

            <button onClick={sendLink} disabled={busy}
              className="w-full py-3 rounded-lg text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>

            {/* Test-login bypass — REMOVE after testing */}
            <div className="mt-6 pt-4" style={{ borderTop: "1px solid #1e1e1e" }}>
              <button onClick={() => setShowTest(!showTest)} className="text-xs" style={{ color: "#555" }}>
                {showTest ? "Hide" : "Test login (dev only)"}
              </button>
              {showTest && (
                <div className="mt-3 flex gap-2">
                  <input value={testCode} onChange={(e) => setTestCode(e.target.value)} placeholder="Test code"
                    className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#e5e7eb" }} />
                  <button onClick={testLogin} disabled={busy}
                    className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#e5e7eb" }}>
                    Enter
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
