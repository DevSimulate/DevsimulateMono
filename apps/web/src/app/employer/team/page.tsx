"use client";

import { useState, useEffect, useCallback } from "react";
import { getToken } from "@/lib/auth";
import { UserPlus, Trash2, Shield } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface Member {
  id: string; role: string; githubUsername: string; email: string | null; isMe: boolean;
}

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  ADMIN:   { bg: "#1e1b4b", color: "#818cf8" },
  MANAGER: { bg: "#052e16", color: "#4ade80" },
  MEMBER:  { bg: "#1a1a1a", color: "#888" },
};

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const token = getToken();
    fetch(`${API}/employer/team`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => { setMembers(j.data?.members ?? []); setMyRole(j.data?.myRole ?? null); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function invite() {
    if (!username.trim()) return;
    setBusy(true); setError(null);
    const token = getToken();
    try {
      const r = await fetch(`${API}/employer/team/invite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ githubUsername: username.trim(), role }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed");
      setUsername("");
      load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to add member"); }
    finally { setBusy(false); }
  }

  async function changeRole(id: string, newRole: string) {
    const token = getToken();
    await fetch(`${API}/employer/team/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ role: newRole }) });
    load();
  }

  async function remove(id: string) {
    const token = getToken();
    await fetch(`${API}/employer/team/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    load();
  }

  const isAdmin = myRole === "ADMIN";

  return (
    <div className="flex flex-col min-h-screen" style={{ color: "#e5e7eb" }}>
      <header className="px-8 py-4" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <h1 className="text-lg font-black text-white">Team</h1>
        <p className="text-xs" style={{ color: "#555" }}>People who can review candidates and manage campaigns</p>
      </header>

      <main className="flex-1 px-8 py-6 max-w-3xl">
        {isAdmin && (
          <div className="rounded-xl p-5 mb-6" style={{ background: "#111", border: "1px solid #222" }}>
            <div className="text-sm font-bold text-white mb-3 flex items-center gap-2"><UserPlus size={15} /> Add a team member</div>
            <div className="flex gap-2">
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Their GitHub username"
                className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#e5e7eb" }} />
              <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#e5e7eb" }}>
                <option value="MEMBER">Member</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button onClick={invite} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#6366f1" }}>Add</button>
            </div>
            {error && <div className="text-xs mt-2" style={{ color: "#f87171" }}>{error}</div>}
            <div className="text-xs mt-2" style={{ color: "#555" }}>They must have signed in to DevSimulate at least once.</div>
          </div>
        )}

        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #222" }}>
          {loading ? <div className="px-5 py-8 text-center text-sm" style={{ color: "#555" }}>Loading…</div> :
            members.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3.5" style={{ background: "#0d0d0d", borderBottom: i < members.length - 1 ? "1px solid #161616" : "none" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "#1e1b4b", color: "#818cf8" }}>{m.githubUsername.charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{m.githubUsername} {m.isMe && <span className="text-xs" style={{ color: "#555" }}>(you)</span>}</div>
                  <div className="text-xs" style={{ color: "#555" }}>{m.email ?? "—"}</div>
                </div>
                {isAdmin && !m.isMe ? (
                  <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} className="rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#e5e7eb" }}>
                    <option value="MEMBER">Member</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                ) : (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: ROLE_STYLE[m.role]?.bg, color: ROLE_STYLE[m.role]?.color }}>
                    {m.role === "ADMIN" && <Shield size={10} />}{m.role[0] + m.role.slice(1).toLowerCase()}
                  </span>
                )}
                {isAdmin && !m.isMe && (
                  <button onClick={() => remove(m.id)} className="p-1.5 rounded-lg" style={{ color: "#666" }} title="Remove"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
        </div>
      </main>
    </div>
  );
}
