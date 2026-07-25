"use client";

import { useState, useEffect, useCallback } from "react";
import { getToken } from "@/lib/auth";
import { UserPlus, Trash2, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge, BadgeTone } from "@/components/ui/Badge";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface Member {
  id: string; role: string; githubUsername: string; email: string | null; isMe: boolean;
}

const ROLE_TONE: Record<string, BadgeTone> = { ADMIN: "good", MANAGER: "neutral", MEMBER: "neutral" };

const SELECT_CLASS = "rounded border border-hairline bg-surface px-2.5 py-2 text-sm text-ink outline-none focus:border-emerald";

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
    <div className="flex flex-col min-h-screen bg-paper text-ink">
      <header className="px-8 py-4 bg-surface border-b border-hairline">
        <h1 className="font-display text-lg font-bold">Team</h1>
        <p className="text-xs text-muted">People who can review candidates and manage campaigns</p>
      </header>

      <main className="flex-1 px-8 py-6 max-w-3xl">
        {isAdmin && (
          <Card className="p-5 mb-6">
            <div className="text-sm font-bold mb-3 flex items-center gap-2"><UserPlus size={15} /> Add a team member</div>
            <div className="flex gap-2">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Their GitHub username" className="flex-1" />
              <select value={role} onChange={(e) => setRole(e.target.value)} className={SELECT_CLASS}>
                <option value="MEMBER">Member</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
              <Button variant="primary" onClick={invite} disabled={busy}>Add</Button>
            </div>
            {error && <div className="text-xs mt-2 text-red">{error}</div>}
            <div className="text-xs mt-2 text-muted">They must have signed in to DevSimulate at least once.</div>
          </Card>
        )}

        <Card className="overflow-hidden">
          {loading ? <div className="px-5 py-8 text-center text-sm text-muted">Loading…</div> :
            members.map((m, i) => (
              <div key={m.id} className={`flex items-center gap-3 px-5 py-3.5 ${i < members.length - 1 ? "border-b border-hairline" : ""}`}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-emerald-weak text-emerald">
                  {m.githubUsername.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{m.githubUsername} {m.isMe && <span className="text-xs text-muted">(you)</span>}</div>
                  <div className="text-xs text-muted">{m.email ?? "—"}</div>
                </div>
                {isAdmin && !m.isMe ? (
                  <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} className={SELECT_CLASS}>
                    <option value="MEMBER">Member</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                ) : (
                  <Badge tone={ROLE_TONE[m.role]}>
                    {m.role === "ADMIN" && <Shield size={10} />}{m.role[0] + m.role.slice(1).toLowerCase()}
                  </Badge>
                )}
                {isAdmin && !m.isMe && (
                  <button onClick={() => remove(m.id)} className="p-1.5 rounded text-muted hover:text-red" title="Remove"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
        </Card>
      </main>
    </div>
  );
}
