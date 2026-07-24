"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface Invite {
  id: string;
  name: string | null;
  email: string;
  githubUsername: string | null;
  status: "INVITED" | "STARTED" | "COMPLETED" | "EXPIRED";
  score: number | null;
  invitedAt: string;
  remindedAt: string | null;
}

const STATUS_STYLE: Record<Invite["status"], { bg: string; fg: string }> = {
  INVITED:   { bg: "#F1F5F9", fg: "#475569" },
  STARTED:   { bg: "#FEF3C7", fg: "#B45309" },
  COMPLETED: { bg: "#DCFCE7", fg: "#15803D" },
  EXPIRED:   { bg: "#FEE2E2", fg: "#B91C1C" },
};

/** Parses pasted "Name, email" / "email" lines (also handles CSV with a header). */
function parseCandidates(raw: string): { name?: string; email: string }[] {
  const out: { name?: string; email: string }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[,\t;]/).map((p) => p.trim());
    const email = parts.find((p) => p.includes("@"));
    if (!email) continue;                                  // skips header rows
    const name = parts.find((p) => p !== email && p.length > 0);
    out.push({ email, ...(name ? { name } : {}) });
  }
  return out;
}

export default function CampaignInvitesPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  /** Loads a dropped/selected CSV into the list. */
  async function readFile(file?: File | null) {
    if (!file) return;
    setError(null); setMsg(null);
    try {
      const text = await file.text();
      if (!parseCandidates(text).length) {
        setError(`No email addresses found in "${file.name}". Make sure it's a CSV with an email column.`);
        return;
      }
      setRaw(text);
      setFileName(file.name);
    } catch {
      setError("Couldn't read that file. Please upload a .csv file.");
    }
  }

  const load = useCallback(async () => {
    const token = getToken();
    try {
      const r = await fetch(`${API}/employer/campaigns/${campaignId}/invites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (j.data) setInvites(j.data);
      else setError(j.error ?? "Failed to load invitations");
    } catch {
      setError("Failed to load invitations");
    }
  }, [campaignId]);

  useEffect(() => { void load(); }, [load]);

  const parsed = parseCandidates(raw);

  async function send() {
    if (!parsed.length) return;
    setBusy(true); setMsg(null); setError(null);
    try {
      const r = await fetch(`${API}/employer/campaigns/${campaignId}/invites`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ candidates: parsed }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to send");
      const d = j.data;
      setMsg(`Sent ${d.emailed} of ${d.total} — ${d.created} new, ${d.skipped} skipped, ${d.failed} failed.`);
      setRaw("");
      setFileName(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send invitations");
    } finally {
      setBusy(false);
    }
  }

  async function remind() {
    setBusy(true); setMsg(null); setError(null);
    try {
      const r = await fetch(`${API}/employer/campaigns/${campaignId}/invites/remind`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to remind");
      setMsg(`Reminded ${j.data.reminded} of ${j.data.pending} who haven't started.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send reminders");
    } finally {
      setBusy(false);
    }
  }

  const counts = invites.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 20px", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#1A1A2E" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Candidate invitations</h1>
      <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>
        Paste your candidate list — one per line, <code>Name, email</code> or just the email.
        Each person gets their own tracked link.
      </p>

      {error && <Banner tone="error">{error}</Banner>}
      {msg && <Banner tone="ok">{msg}</Banner>}

      <div style={card}>
        {/* Drop zone / file picker — the primary way to load candidates. */}
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void readFile(e.dataTransfer.files?.[0]); }}
          style={{
            display: "block", border: `2px dashed ${dragging ? "#4F46E5" : "#CBD5E1"}`,
            background: dragging ? "#EEF0FF" : "#F8FAFC", borderRadius: 12,
            padding: "26px 18px", textAlign: "center", cursor: "pointer",
          }}
        >
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            style={{ display: "none" }}
            onChange={(e) => { void readFile(e.target.files?.[0]); e.currentTarget.value = ""; }}
          />
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            {fileName ? `📄 ${fileName}` : "Upload your candidate file"}
          </div>
          <div style={{ fontSize: 12.5, color: "#6B7280" }}>
            Click to choose a <strong>.csv</strong> file, or drag it here.<br />
            In Excel: <em>File → Save As → CSV</em>. Columns: name, email (a header row is fine).
          </div>
        </label>

        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 12.5, color: "#6B7280", cursor: "pointer" }}>
            or paste the list manually
          </summary>
          <textarea
            value={raw}
            onChange={(e) => { setRaw(e.target.value); setFileName(null); }}
            rows={6}
            placeholder={"Ali Raza, ali@example.com\nSara Khan, sara@example.com\nomar@example.com"}
            style={{ width: "100%", boxSizing: "border-box", marginTop: 8, border: "1.5px solid #E5E7EB", borderRadius: 10, padding: 12, fontSize: 14, fontFamily: "monospace", resize: "vertical" }}
          />
        </details>

        {parsed.length > 0 && (
          <div style={{ marginTop: 12, background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px", maxHeight: 132, overflowY: "auto" }}>
            {parsed.slice(0, 5).map((c, i) => (
              <div key={i} style={{ fontSize: 12.5, color: "#475569" }}>
                {c.name ? `${c.name} — ` : ""}{c.email}
              </div>
            ))}
            {parsed.length > 5 && (
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                …and {parsed.length - 5} more
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <span style={{ fontSize: 13, color: "#6B7280" }}>
            {parsed.length} valid {parsed.length === 1 ? "address" : "addresses"} detected
          </span>
          <button onClick={send} disabled={busy || !parsed.length} style={btn(!busy && parsed.length > 0)}>
            {busy ? "Sending…" : `Send ${parsed.length || ""} invitation${parsed.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, margin: "22px 0 14px", flexWrap: "wrap", alignItems: "center" }}>
        {(["INVITED", "STARTED", "COMPLETED", "EXPIRED"] as const).map((s) => (
          <span key={s} style={{ ...pill(STATUS_STYLE[s]), fontSize: 12 }}>
            {s} · {counts[s] ?? 0}
          </span>
        ))}
        <button onClick={remind} disabled={busy} style={{ ...btn(!busy), marginLeft: "auto", background: "#fff", color: "#4F46E5", border: "1.5px solid #C7D2FE" }}>
          Remind non-starters
        </button>
      </div>

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr>
              {["Candidate", "Email", "GitHub", "Status", "Score"].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 && (
              <tr><td colSpan={5} style={{ ...td, color: "#9CA3AF", textAlign: "center", padding: 24 }}>
                No invitations sent yet.
              </td></tr>
            )}
            {invites.map((i) => (
              <tr key={i.id}>
                <td style={td}>{i.name ?? "—"}</td>
                <td style={{ ...td, color: "#6B7280" }}>{i.email}</td>
                <td style={{ ...td, color: "#6B7280" }}>{i.githubUsername ?? "—"}</td>
                <td style={td}><span style={pill(STATUS_STYLE[i.status])}>{i.status}</span></td>
                <td style={{ ...td, fontWeight: 700 }}>{i.score ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  const ok = tone === "ok";
  return (
    <div style={{
      background: ok ? "#ECFDF5" : "#FEF2F2",
      border: `1px solid ${ok ? "#A7F3D0" : "#FECACA"}`,
      color: ok ? "#065F46" : "#B91C1C",
      borderRadius: 10, padding: "11px 14px", fontSize: 13.5, marginBottom: 16,
    }}>{children}</div>
  );
}

const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16,
};
const th: React.CSSProperties = {
  textAlign: "left", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase",
  color: "#6B7280", fontWeight: 700, padding: "10px 14px", borderBottom: "2px solid #E5E7EB",
};
const td: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid #F1F5F9" };

function pill(s: { bg: string; fg: string }): React.CSSProperties {
  return {
    background: s.bg, color: s.fg, borderRadius: 20, padding: "3px 10px",
    fontSize: 11.5, fontWeight: 700, display: "inline-block",
  };
}
function btn(enabled: boolean): React.CSSProperties {
  return {
    background: enabled ? "#4F46E5" : "#C7C9D1", color: "#fff", border: "none",
    borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 700,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}
