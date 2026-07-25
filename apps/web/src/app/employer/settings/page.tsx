"use client";

import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { Check, Building2, Users, Megaphone, Palette } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

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
  const previewColor = primaryColor || "#5B5BD6";

  if (loading) return <div className="p-10 text-sm text-muted">Loading…</div>;

  return (
    <div className="flex flex-col min-h-screen bg-paper text-ink">
      <header className="px-8 py-4 bg-surface border-b border-hairline">
        <h1 className="font-display text-lg font-bold">Settings</h1>
        <p className="text-xs text-muted">Manage your organisation</p>
      </header>

      <main className="flex-1 px-8 py-6 max-w-2xl space-y-5">
        {/* Org profile */}
        <Card className="p-6">
          <div className="text-sm font-bold mb-4 flex items-center gap-2"><Building2 size={15} /> Organisation</div>
          <Field label="Company name">
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!isAdmin} />
          </Field>
          <Field label="Domain">
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} disabled={!isAdmin} placeholder="acme.com" />
          </Field>
          {isAdmin ? (
            <Button variant="primary" onClick={save} disabled={saving}>
              {saved ? <><Check size={15} /> Saved</> : saving ? "Saving…" : "Save changes"}
            </Button>
          ) : (
            <div className="text-xs text-muted">Only admins can edit organisation settings.</div>
          )}
        </Card>

        {/* Branding */}
        <Card className="p-6">
          <div className="text-sm font-bold mb-1 flex items-center gap-2"><Palette size={15} /> Branding</div>
          <p className="text-xs text-muted mb-4">Applied to your candidate apply page, leaderboard, and contest links.</p>

          <Field label="Brand name (shown to candidates)">
            <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} disabled={!isAdmin} placeholder={data?.orgName ?? "LMKR"} />
          </Field>

          <Field label="Logo URL">
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} disabled={!isAdmin} placeholder="https://cdn.yourcompany.com/logo.png" />
          </Field>
          {logoUrl && (
            <div className="mb-4 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Logo preview" className="h-10 rounded object-contain bg-paper p-1"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <span className="text-xs text-muted">Preview</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-5">
            <Field label="Primary colour">
              <div className="flex items-center gap-2">
                <input type="color" value={previewColor}
                  onChange={(e) => setPrimaryColor(e.target.value)} disabled={!isAdmin}
                  className="w-10 h-10 rounded cursor-pointer disabled:opacity-60 border border-hairline p-0.5" />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} disabled={!isAdmin} placeholder="#1B74BC" className="flex-1" />
              </div>
            </Field>
            <Field label="Accent colour">
              <div className="flex items-center gap-2">
                <input type="color" value={accentColor || "#5B5BD6"}
                  onChange={(e) => setAccentColor(e.target.value)} disabled={!isAdmin}
                  className="w-10 h-10 rounded cursor-pointer disabled:opacity-60 border border-hairline p-0.5" />
                <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} disabled={!isAdmin} placeholder="#E8762B" className="flex-1" />
              </div>
            </Field>
          </div>

          {/* Live preview strip */}
          <div className="rounded border border-hairline bg-paper p-4 mb-4">
            <div className="text-[10px] uppercase tracking-widest text-muted mb-2">Preview</div>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="logo" className="h-8 rounded object-contain bg-paper p-0.5" />
              ) : (
                <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                  style={{ background: previewColor + "22", color: previewColor }}>
                  {(brandName || data?.orgName || "CO").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-sm font-bold">{brandName || data?.orgName || "Your Company"}</div>
                <div className="text-xs text-muted">is hiring</div>
              </div>
              <div className="ml-auto">
                <div className="px-3 py-1.5 rounded text-xs font-bold text-white" style={{ background: previewColor }}>
                  Join Campaign
                </div>
              </div>
            </div>
          </div>

          {isAdmin && (
            <Button onClick={save} disabled={saving} style={{ background: previewColor, borderColor: previewColor }} className="text-white">
              {saved ? <><Check size={15} /> Saved</> : saving ? "Saving…" : "Save branding"}
            </Button>
          )}
        </Card>

        {/* At a glance */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: Megaphone, label: "Campaigns", value: data?.campaignCount ?? 0 },
            { icon: Users,     label: "Team members", value: data?.memberCount ?? 0 },
          ].map(({ icon: Icon, label, value }) => (
            <Card key={label} className="p-4">
              <Icon size={15} className="text-emerald mb-2" />
              <div className="font-display text-xl font-bold">{value}</div>
              <div className="text-xs text-muted">{label}</div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
