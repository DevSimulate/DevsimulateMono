"use client";

import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { Check, Building2, Users, Megaphone, CreditCard, Palette } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface SettingsData {
  orgName: string; domain: string; plan: string; tier: string;
  memberCount: number; campaignCount: number; myRole: string | null;
  logoUrl: string; primaryColor: string; accentColor: string; brandName: string;
}

export default function SettingsPage() {
  const [data,         setData]         = useState<SettingsData | null>(null);
  const [orgName,      setOrgName]      = useState("");
  const [domain,       setDomain]       = useState("");
  const [logoUrl,      setLogoUrl]      = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [accentColor,  setAccentColor]  = useState("");
  const [brandName,    setBrandName]    = useState("");
  const [loading, setLoading] = useState(true);
  const [saved,   setSaved]   = useState(false);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/employer/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setData(j.data);
          setOrgName(j.data.orgName);
          setDomain(j.data.domain);
          setLogoUrl(j.data.logoUrl ?? "");
          setPrimaryColor(j.data.primaryColor ?? "");
          setAccentColor(j.data.accentColor ?? "");
          setBrandName(j.data.brandName ?? "");
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    const token = getToken();
    await fetch(`${API}/employer/settings`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ orgName, domain, logoUrl, primaryColor, accentColor, brandName }),
    });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  const isAdmin      = data?.myRole === "ADMIN";
  const inputStyle   = { background: "#f2f4f7", border: "1px solid #d5d9e0", color: "#131722" };
  const previewColor = primaryColor || "#5B5BD6";
  const previewAccent = accentColor || "#5B5BD6";

  if (loading) return <div className="p-10 text-sm" style={{ color: "#8a93a3" }}>Loading…</div>;

  return (
    <div className="flex flex-col min-h-screen" style={{ color: "#131722" }}>
      <header className="px-8 py-4" style={{ background: "#f5f6f8", borderBottom: "1px solid #eef1f5" }}>
        <h1 className="text-lg font-black text-[#131722]">Settings</h1>
        <p className="text-xs" style={{ color: "#8a93a3" }}>Manage your organisation</p>
      </header>

      <main className="flex-1 px-8 py-6 max-w-2xl space-y-5">
        {/* Org profile */}
        <div className="rounded-xl p-6" style={{ background: "#ffffff", border: "1px solid #222" }}>
          <div className="text-sm font-bold text-[#131722] mb-4 flex items-center gap-2"><Building2 size={15} /> Organisation</div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "#5a6472" }}>Company name</label>
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!isAdmin}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-4 disabled:opacity-60" style={inputStyle} />
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "#5a6472" }}>Domain</label>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} disabled={!isAdmin} placeholder="acme.com"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-4 disabled:opacity-60" style={inputStyle} />
          {isAdmin && (
            <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-lg text-sm font-bold text-[#131722] flex items-center gap-2" style={{ background: "#4338ca" }}>
              {saved ? <><Check size={15} /> Saved</> : saving ? "Saving…" : "Save Changes"}
            </button>
          )}
          {!isAdmin && <div className="text-xs" style={{ color: "#8a93a3" }}>Only admins can edit organisation settings.</div>}
        </div>

        {/* Branding */}
        <div className="rounded-xl p-6" style={{ background: "#ffffff", border: "1px solid #222" }}>
          <div className="text-sm font-bold text-[#131722] mb-1 flex items-center gap-2"><Palette size={15} /> Branding</div>
          <p className="text-xs mb-4" style={{ color: "#8a93a3" }}>
            Applied to your candidate apply page, leaderboard, and contest links.
          </p>

          <label className="block text-xs font-semibold mb-1.5" style={{ color: "#5a6472" }}>Brand name (shown to candidates)</label>
          <input value={brandName} onChange={(e) => setBrandName(e.target.value)} disabled={!isAdmin}
            placeholder={data?.orgName ?? "LMKR"}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-4 disabled:opacity-60" style={inputStyle} />

          <label className="block text-xs font-semibold mb-1.5" style={{ color: "#5a6472" }}>Logo URL</label>
          <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} disabled={!isAdmin}
            placeholder="https://cdn.yourcompany.com/logo.png"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-4 disabled:opacity-60" style={inputStyle} />
          {logoUrl && (
            <div className="mb-4 flex items-center gap-3">
              <img src={logoUrl} alt="Logo preview" className="h-10 rounded object-contain"
                style={{ background: "#eef1f5", padding: "4px" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <span className="text-xs" style={{ color: "#8a93a3" }}>Preview</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#5a6472" }}>Primary colour</label>
              <div className="flex items-center gap-2">
                <input type="color" value={previewColor}
                  onChange={(e) => setPrimaryColor(e.target.value)} disabled={!isAdmin}
                  className="w-10 h-10 rounded cursor-pointer disabled:opacity-60"
                  style={{ background: "none", border: "1px solid #d5d9e0", padding: "2px" }} />
                <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} disabled={!isAdmin}
                  placeholder="#1B74BC"
                  className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none disabled:opacity-60" style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#5a6472" }}>Accent colour</label>
              <div className="flex items-center gap-2">
                <input type="color" value={previewAccent}
                  onChange={(e) => setAccentColor(e.target.value)} disabled={!isAdmin}
                  className="w-10 h-10 rounded cursor-pointer disabled:opacity-60"
                  style={{ background: "none", border: "1px solid #d5d9e0", padding: "2px" }} />
                <input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} disabled={!isAdmin}
                  placeholder="#E8762B"
                  className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none disabled:opacity-60" style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Live preview strip */}
          <div className="rounded-lg p-4 mb-4" style={{ background: "#f2f4f7", border: "1px solid #e4e7ec" }}>
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "#8a93a3" }}>Preview</div>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="h-8 rounded object-contain" style={{ background: "#eef1f5", padding: "2px" }} />
              ) : (
                <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-black"
                  style={{ background: previewColor + "22", color: previewColor }}>
                  {(brandName || data?.orgName || "CO").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-sm font-black text-[#131722]">{brandName || data?.orgName || "Your Company"}</div>
                <div className="text-xs" style={{ color: "#5a6472" }}>is hiring</div>
              </div>
              <div className="ml-auto">
                <div className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#131722]" style={{ background: previewColor }}>
                  Join Campaign
                </div>
              </div>
            </div>
          </div>

          {isAdmin && (
            <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-lg text-sm font-bold text-[#131722] flex items-center gap-2" style={{ background: previewColor }}>
              {saved ? <><Check size={15} /> Saved</> : saving ? "Saving…" : "Save Branding"}
            </button>
          )}
        </div>

        {/* At a glance */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Megaphone, label: "Campaigns", value: data?.campaignCount ?? 0, accent: "#4338ca" },
            { icon: Users,     label: "Team members", value: data?.memberCount ?? 0, accent: "#067647" },
            { icon: CreditCard, label: "Plan", value: data?.plan ?? "—",            accent: "#b54708" },
          ].map(({ icon: Icon, label, value, accent }) => (
            <div key={label} className="rounded-xl p-4" style={{ background: "#ffffff", border: "1px solid #222" }}>
              <Icon size={15} style={{ color: accent }} className="mb-2" />
              <div className="text-xl font-black text-[#131722]">{value}</div>
              <div className="text-xs" style={{ color: "#5a6472" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Billing */}
        <div className="rounded-xl p-6" style={{ background: "#ffffff", border: "1px solid #222" }}>
          <div className="text-sm font-bold text-[#131722] mb-2 flex items-center gap-2"><CreditCard size={15} /> Billing</div>
          <p className="text-sm" style={{ color: "#5a6472" }}>
            Current plan: <span className="font-bold text-[#131722]">{data?.plan ?? "HIRING"}</span>. Manage billing and seats from your account.
          </p>
        </div>
      </main>
    </div>
  );
}
