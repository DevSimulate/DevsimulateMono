"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { ArrowLeft, Copy, Check, ExternalLink } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com";

interface Codebase { id: string; name: string; stack: string; }

const inputStyle = {
  background: "#0d0d0d",
  border: "1px solid #2a2a2a",
  color: "#e5e7eb",
};

export default function NewCampaignPage() {
  const router = useRouter();
  const [codebases, setCodebases] = useState<Codebase[]>([]);
  const [form, setForm] = useState({
    roleName: "",
    codebaseId: "",
    difficulty: "MID",
    candidateLimit: 100,
    deadline: "",
    companyName: "",
    bookingLink: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/employer/campaigns/codebases`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        setCodebases(j.data ?? []);
        if (j.data?.[0]) setForm((f) => ({ ...f, codebaseId: j.data[0].id }));
      })
      .catch(() => null);
  }, []);

  async function handleSubmit() {
    setError(null);
    if (!form.roleName || !form.codebaseId || !form.companyName) {
      setError("Role name, codebase, and company name are required.");
      return;
    }
    setSubmitting(true);
    try {
      const token = getToken();
      const res = await fetch(`${API}/employer/campaigns`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create campaign");
      setCreatedSlug(json.data.shareableSlug);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  const fullLink = createdSlug ? `${APP_URL}/apply/${createdSlug}` : "";

  function copyLink() {
    navigator.clipboard.writeText(fullLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Success view
  if (createdSlug) {
    return (
      <div className="flex flex-col min-h-screen" style={{ color: "#e5e7eb" }}>
        <header className="px-8 py-4" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
          <h1 className="text-lg font-black text-white">Campaign Created</h1>
        </header>
        <main className="flex-1 px-8 py-10 max-w-2xl mx-auto w-full">
          <div className="rounded-xl p-8 text-center" style={{ background: "#111111", border: "1px solid #222222" }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "#052e16" }}>
              <Check size={28} style={{ color: "#4ade80" }} />
            </div>
            <div className="text-xl font-black text-white mb-1">Your campaign is live!</div>
            <div className="text-sm mb-6" style={{ color: "#888888" }}>
              Share this link with candidates. When they open it, they sign in with GitHub and
              get assigned a ticket automatically.
            </div>

            <div className="rounded-lg p-4 mb-6 text-left" style={{ background: "#0d0d0d", border: "1px solid #2a2a2a" }}>
              <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "#555555" }}>
                Application Link
              </div>
              <div className="flex items-center gap-3">
                <code className="flex-1 text-sm break-all" style={{ color: "#818cf8" }}>{fullLink}</code>
                <button onClick={copyLink}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ background: "#6366f1" }}>
                  {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                </button>
              </div>
            </div>

            <div className="rounded-lg p-4 mb-6 text-left" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
              <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "#555555" }}>
                What candidates see
              </div>
              <div className="text-sm" style={{ color: "#aaaaaa" }}>
                <span className="font-bold text-white">{form.companyName}</span> is hiring for{" "}
                <span className="font-bold text-white">{form.roleName}</span>. Complete a real{" "}
                {form.difficulty.toLowerCase()}-level coding ticket to be considered.
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/employer/campaigns"
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-center text-white"
                style={{ background: "#6366f1" }}>
                View All Campaigns
              </Link>
              <a href={fullLink} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#e5e7eb" }}>
                Preview <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Form view
  return (
    <div className="flex flex-col min-h-screen" style={{ color: "#e5e7eb" }}>
      <header className="px-8 py-4 flex items-center gap-4" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <Link href="/employer/campaigns" style={{ color: "#888888" }}><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-lg font-black text-white">New Campaign</h1>
          <p className="text-xs" style={{ color: "#555555" }}>Create a hiring assessment campaign</p>
        </div>
      </header>

      <main className="flex-1 px-8 py-8 max-w-2xl mx-auto w-full">
        <div className="rounded-xl p-6 space-y-5" style={{ background: "#111111", border: "1px solid #222222" }}>

          {error && (
            <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "#1c0000", border: "1px solid #7f1d1d", color: "#f87171" }}>
              {error}
            </div>
          )}

          <Field label="Role Name">
            <input value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })}
              placeholder="Senior Backend Engineer" className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
          </Field>

          <Field label="Company Name">
            <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              placeholder="Acme Inc." className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Codebase">
              <select value={form.codebaseId} onChange={(e) => setForm({ ...form, codebaseId: e.target.value })}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle}>
                {codebases.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            <Field label="Difficulty">
              <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle}>
                <option value="JUNIOR">Junior</option>
                <option value="MID">Mid</option>
                <option value="SENIOR">Senior</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Candidate Limit">
              <input type="number" value={form.candidateLimit}
                onChange={(e) => setForm({ ...form, candidateLimit: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>

            <Field label="Deadline">
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
          </div>

          <Field label="Interview Booking Link (Calendly, etc.)">
            <input value={form.bookingLink} onChange={(e) => setForm({ ...form, bookingLink: e.target.value })}
              placeholder="https://calendly.com/your-team/interview"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
          </Field>

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-3 rounded-lg text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
            {submitting ? "Creating…" : "Create Campaign & Generate Link"}
          </button>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888888" }}>{label}</label>
      {children}
    </div>
  );
}
