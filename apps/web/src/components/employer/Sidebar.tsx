"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { BoltIcon } from "@/components/Logo";
import {
  LayoutDashboard,
  Users,
  Building2,
  Settings,
  LogOut,
  ChevronRight,
  Megaphone,
} from "lucide-react";

const NAV = [
  { href: "/employer/dashboard",   label: "Dashboard",  icon: LayoutDashboard },
  { href: "/employer/campaigns",   label: "Campaigns",  icon: Megaphone },
  { href: "/employer/candidates",  label: "Candidates", icon: Users },
  { href: "/employer/team",        label: "Team",       icon: Building2 },
  { href: "/employer/settings",    label: "Settings",   icon: Settings },
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

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-60 flex flex-col z-40"
      style={{ background: "#111111", borderRight: "1px solid #222222" }}
    >
      {/* Logo */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid #222222" }}>
        <div className="flex items-center gap-2 mb-3">
          <BoltIcon size={28} />
          <span className="font-black text-white text-sm tracking-tight">DevSimulate</span>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: "#1e1b4b", color: "#818cf8", border: "1px solid #312e81" }}>
          Employer Portal
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group"
              style={{
                background: active ? "#1e1b4b" : "transparent",
                color:      active ? "#818cf8" : "#888888",
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "#1a1a1a";
                  (e.currentTarget as HTMLElement).style.color = "#ffffff";
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "#888888";
                }
              }}
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={13} style={{ opacity: 0.6 }} />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3" style={{ borderTop: "1px solid #222222" }}>
        {/* Plan */}
        <div className="rounded-lg px-3 py-2.5 mb-3"
          style={{ background: "#0d0d1a", border: "1px solid #2d2b55" }}>
          <div className="text-xs font-bold mb-0.5" style={{ color: "#6366f1" }}>PRO PLAN</div>
          <div className="text-xs font-semibold text-white">$299 / month</div>
        </div>

        {/* Company */}
        <div className="flex items-center gap-2.5 px-1 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: "#1e1b4b", color: "#818cf8" }}>
            {(profile?.orgName ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{profile?.orgName ?? "—"}</div>
            <div className="text-xs truncate" style={{ color: "#555555" }}>
              {profile?.email ?? (profile ? `@${profile.githubUsername}` : "Not signed in")}
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg w-full text-xs font-medium transition-all"
          style={{ color: "#555555" }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = "#ef4444";
            (e.currentTarget as HTMLElement).style.background = "#1a0a0a";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = "#555555";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </aside>
  );
}
