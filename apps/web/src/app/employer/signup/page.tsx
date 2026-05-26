"use client";

import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

export default function EmployerSignupPage(): React.ReactElement {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [plan, setPlan] = useState<"HIRING" | "TRAINING">("HIRING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const token = getToken();
    if (!token) { router.push("/"); return; }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
      const res = await axios.post(
        `${apiUrl}/organisations`,
        { name, domain: domain || undefined, plan },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const orgId = res.data.data.id as string;
      if (typeof window !== "undefined") {
        localStorage.setItem("ds_org_id", orgId);
      }
      router.push("/employer/dashboard");
    } catch {
      setError("Failed to create organisation. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-6">
      <Link href="/" className="font-bold text-white tracking-tight mb-10 text-xl">
        ⚡ DevSimulate
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h1 className="text-2xl font-black mb-1">Create your organisation</h1>
        <p className="text-slate-400 text-sm mb-6">Set up your employer account to start hiring.</p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Company name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Acme Corp"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Company domain (optional)</label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="acmecorp.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Plan</label>
            <div className="grid grid-cols-2 gap-3">
              {(["HIRING", "TRAINING"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlan(p)}
                  className={`rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
                    plan === p
                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                      : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {p === "HIRING" ? "Hiring — $299/mo" : "Training — $499/mo"}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !name}
            className="w-full rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold py-3 text-sm transition-colors mt-2"
          >
            {loading ? "Creating…" : "Create Organisation"}
          </button>
        </form>
      </div>
    </div>
  );
}
