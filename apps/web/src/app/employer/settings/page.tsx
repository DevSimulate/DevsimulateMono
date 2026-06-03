"use client";

import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { Check, Building2, Users, Megaphone, CreditCard } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface SettingsData {
  orgName: string; domain: string; plan: string; tier: string;
  memberCount: number; campaignCount: number; myRole: string | null;
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [orgName, setOrgName] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/employer/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => { if (j.data) { setData(j.data); setOrgName(j.data.orgName); setDomain(j.data.domain); } })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    const token = getToken();
    await fetch(`${API}/employer/settings`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ orgName, domain }),
    });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  const isAdmin = data?.myRole === "ADMIN";
  const inputStyle = { background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#e5e7eb" };

  if (loading) return <div className="p-10 text-sm" style={{ color: "#555" }}>Loading…</div>;

  return (
    <div className="flex flex-col min-h-screen" style={{ color: "#e5e7eb" }}>
      <header className="px-8 py-4" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <h1 className="text-lg font-black text-white">Settings</h1>
        <p className="text-xs" style={{ color: "#555" }}>Manage your organisation</p>
      </header>

      <main className="flex-1 px-8 py-6 max-w-2xl space-y-5">
        {/* Org profile */}
        <div className="rounded-xl p-6" style={{ background: "#111", border: "1px solid #222" }}>
          <div className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Building2 size={15} /> Organisation</div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>Company name</label>
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!isAdmin}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-4 disabled:opacity-60" style={inputStyle} />
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>Domain</label>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} disabled={!isAdmin} placeholder="acme.com"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-4 disabled:opacity-60" style={inputStyle} />
          {isAdmin && (
            <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-lg text-sm font-bold text-white flex items-center gap-2" style={{ background: "#6366f1" }}>
              {saved ? <><Check size={15} /> Saved</> : saving ? "Saving…" : "Save Changes"}
            </button>
          )}
          {!isAdmin && <div className="text-xs" style={{ color: "#555" }}>Only admins can edit organisation settings.</div>}
        </div>

        {/* At a glance */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Megaphone, label: "Campaigns", value: data?.campaignCount ?? 0, accent: "#6366f1" },
            { icon: Users, label: "Team members", value: data?.memberCount ?? 0, accent: "#22c55e" },
            { icon: CreditCard, label: "Plan", value: data?.plan ?? "—", accent: "#f59e0b" },
          ].map(({ icon: Icon, label, value, accent }) => (
            <div key={label} className="rounded-xl p-4" style={{ background: "#111", border: "1px solid #222" }}>
              <Icon size={15} style={{ color: accent }} className="mb-2" />
              <div className="text-xl font-black text-white">{value}</div>
              <div className="text-xs" style={{ color: "#888" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Billing */}
        <div className="rounded-xl p-6" style={{ background: "#111", border: "1px solid #222" }}>
          <div className="text-sm font-bold text-white mb-2 flex items-center gap-2"><CreditCard size={15} /> Billing</div>
          <p className="text-sm" style={{ color: "#888" }}>
            Current plan: <span className="font-bold text-white">{data?.plan ?? "HIRING"}</span>. Manage billing and seats from your account.
          </p>
        </div>
      </main>
    </div>
  );
}
