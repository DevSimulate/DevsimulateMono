"use client";

import { useState } from "react";
import { storeToken } from "@/lib/auth";
import { BoltIcon } from "@/components/Logo";
import { Mail, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

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
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <Card className="max-w-md w-full p-8">
        <div className="flex items-center gap-2 mb-6">
          <BoltIcon size={28} /><span className="font-display font-bold">DevSimulate</span>
        </div>
        <Badge tone="neutral" className="mb-4">Employer portal</Badge>

        {sent ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-emerald-weak">
              <Check size={28} className="text-emerald" />
            </div>
            <h1 className="font-display text-xl font-bold mb-1">Check your inbox</h1>
            <p className="text-sm text-muted">
              We sent a sign-in link to <span className="text-ink font-semibold">{email}</span>. Click it to continue. It expires in 15 minutes.
            </p>
            <button onClick={() => setSent(false)} className="text-xs mt-4 text-brand hover:underline">Use a different email</button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold mb-1">Sign in to hire</h1>
            <p className="text-sm text-muted mb-6">
              No GitHub needed — we&apos;ll email you a secure sign-in link.
            </p>

            {error && <div className="rounded bg-red-weak px-3 py-2 mb-4 text-xs text-red">{error}</div>}

            <label className="block text-xs font-semibold mb-1.5 text-muted">Work email</label>
            <div className="flex items-center gap-2 rounded border border-hairline bg-paper px-3 mb-4">
              <Mail size={15} className="text-muted" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
                onKeyDown={(e) => e.key === "Enter" && sendLink()}
                className="flex-1 bg-transparent py-2.5 text-sm outline-none text-ink" />
            </div>

            <Button variant="primary" onClick={sendLink} disabled={busy} className="w-full">
              {busy ? "Sending…" : "Email me a sign-in link"}
            </Button>

            {/* Test-login bypass — REMOVE after testing */}
            <div className="mt-6 pt-4 border-t border-hairline">
              <button onClick={() => setShowTest(!showTest)} className="text-xs text-muted hover:text-ink">
                {showTest ? "Hide" : "Test login (dev only)"}
              </button>
              {showTest && (
                <div className="mt-3 flex gap-2">
                  <Input value={testCode} onChange={(e) => setTestCode(e.target.value)} placeholder="Test code" className="flex-1" />
                  <Button variant="secondary" onClick={testLogin} disabled={busy}>Enter</Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
