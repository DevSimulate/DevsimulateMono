"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BoltIcon } from "@/components/Logo";
import { clearToken, getToken } from "@/lib/auth";
import {
  LayoutDashboard,
  Users,
  Building2,
  Settings,
  LogOut,
  Megaphone,
  CreditCard,
} from "lucide-react";

const NAV_GROUPS: { label: string; items: { href: string; label: string; icon: typeof Users }[] }[] = [
  {
    label: "Hiring",
    items: [
      { href: "/employer/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
      { href: "/employer/campaigns",  label: "Campaigns",  icon: Megaphone },
      { href: "/employer/candidates", label: "Candidates", icon: Users },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/employer/team",     label: "Team",            icon: Building2 },
      { href: "/employer/pricing",  label: "Plans & Billing", icon: CreditCard },
      { href: "/employer/settings", label: "Settings",        icon: Settings },
    ],
  },
];

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<{ orgName: string; githubUsername: string; email: string | null } | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API}/employer/campaigns/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => { if (j.data) setProfile(j.data); })
      .catch(() => null);
  }, []);

  function handleLogout() {
    clearToken();
    if (typeof window !== "undefined") localStorage.removeItem("ds_org_id");
    router.push("/");
  }

  const org = profile?.orgName ?? "—";

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-60 flex flex-col z-40"
      style={{ background: "var(--p-sidebar)", color: "var(--p-sidebar-text)" }}
    >
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-2.5">
        <BoltIcon size={32} />
        <div>
          <div className="font-bold text-white text-sm tracking-tight leading-none">DevSimulate</div>
          <div className="text-[10.5px] mt-1 font-medium" style={{ color: "var(--p-sidebar-dim)" }}>for Employers</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2.5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            <div className="px-2.5 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--p-sidebar-dim)" }}>
              {group.label}
            </div>
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5"
                  style={{
                    background: active ? "var(--p-sidebar-active)" : "transparent",
                    color: active ? "#ffffff" : "var(--p-sidebar-text)",
                    fontWeight: active ? 600 : 500,
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "#ffffff0d"; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <Icon size={16} style={{ opacity: active ? 1 : 0.8 }} />
                  <span className="flex-1">{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Company footer */}
      <div className="p-3" style={{ borderTop: "1px solid #ffffff14" }}>
        <div className="flex items-center gap-2.5 px-1.5 py-1.5 mb-1">
          <div className="w-8 h-8 rounded-lg grid place-items-center text-xs font-bold shrink-0"
            style={{ background: "#2a2f3a", color: "#cbd2e0" }}>
            {org.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-white truncate">{org}</div>
            <div className="text-[11px] truncate" style={{ color: "var(--p-sidebar-dim)" }}>
              {profile?.email ?? (profile ? `@${profile.githubUsername}` : "Not signed in")} · Pro
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg w-full text-xs font-medium transition-colors"
          style={{ color: "var(--p-sidebar-dim)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f0776d"; (e.currentTarget as HTMLElement).style.background = "#ffffff0d"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--p-sidebar-dim)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
