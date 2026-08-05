"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

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

const STATUS_TONE: Record<Invite["status"], BadgeTone> = {
  INVITED: "neutral",
  STARTED: "warn",
  COMPLETED: "good",
  EXPIRED: "bad",
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
  const [closingPreview, setClosingPreview] = useState<{
    total: number; finished: number; wouldEmail: number;
    notStarted: number; startedUnfinished: number;
    recipients: { email: string; name: string | null; started: boolean }[];
  } | null>(null);
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

  // Two steps on purpose. This reaches everyone who hasn't finished — often the
  // whole list — so the preview names the audience before anything is sent,
  // rather than after.
  async function previewClosing() {
    setBusy(true); setMsg(null); setError(null);
    try {
      const r = await fetch(`${API}/employer/campaigns/${campaignId}/invites/closing-soon`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Preview failed");
      setClosingPreview(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendClosing() {
    setBusy(true); setMsg(null); setError(null);
    try {
      const r = await fetch(`${API}/employer/campaigns/${campaignId}/invites/closing-soon`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to send");
      setMsg(`Sent to ${j.data.sent} of ${j.data.targeted} — ${j.data.notStarted} never started, ${j.data.startedUnfinished} started but unfinished. ${j.data.finished} who finished were skipped.`);
      setClosingPreview(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setBusy(false);
    }
  }

  const counts = invites.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto px-5 py-8 text-ink">
      <h1 className="font-display text-2xl font-bold mb-1">Candidate invitations</h1>
      <p className="text-sm text-muted mb-6">
        Paste your candidate list — one per line, <span className="font-mono">Name, email</span> or just the email.
        Each person gets their own tracked link.
      </p>

      {error && <Banner tone="error">{error}</Banner>}
      {msg && <Banner tone="ok">{msg}</Banner>}

      <Card className="p-4">
        {/* Drop zone / file picker — the primary way to load candidates. */}
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void readFile(e.dataTransfer.files?.[0]); }}
          className="block rounded border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors duration-150"
          style={{
            borderColor: dragging ? "var(--brand)" : "var(--hairline)",
            background: dragging ? "rgba(79,70,229,0.06)" : "var(--paper)",
          }}
        >
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => { void readFile(e.target.files?.[0]); e.currentTarget.value = ""; }}
          />
          <div className="text-sm font-semibold mb-1">
            {fileName ? `File selected: ${fileName}` : "Upload your candidate file"}
          </div>
          <div className="text-xs text-muted leading-relaxed">
            Click to choose a <span className="font-semibold">.csv</span> file, or drag it here.<br />
            In Excel: <em>File → Save As → CSV</em>. Columns: name, email (a header row is fine).
          </div>
        </label>

        <details className="mt-3">
          <summary className="text-xs text-muted cursor-pointer">or paste the list manually</summary>
          <textarea
            value={raw}
            onChange={(e) => { setRaw(e.target.value); setFileName(null); }}
            rows={6}
            placeholder={"Ali Raza, ali@example.com\nSara Khan, sara@example.com\nomar@example.com"}
            className="w-full mt-2 rounded border border-hairline bg-surface px-3 py-2.5 text-sm font-mono resize-y focus:border-brand focus:outline-none focus:ring-2 focus:ring-[rgba(79,70,229,0.25)]"
          />
        </details>

        {parsed.length > 0 && (
          <div className="mt-3 rounded border border-hairline bg-paper px-3 py-2.5 max-h-32 overflow-y-auto">
            {parsed.slice(0, 5).map((c, i) => (
              <div key={i} className="text-xs text-muted font-mono">
                {c.name ? `${c.name} — ` : ""}{c.email}
              </div>
            ))}
            {parsed.length > 5 && (
              <div className="text-xs text-muted mt-1">…and {parsed.length - 5} more</div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted">
            {parsed.length} valid {parsed.length === 1 ? "address" : "addresses"} detected
          </span>
          <Button variant="primary" onClick={send} disabled={busy || !parsed.length}>
            {busy ? "Sending…" : `Send ${parsed.length || ""} invitation${parsed.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </Card>

      <div className="flex gap-2.5 my-5 flex-wrap items-center">
        {(["INVITED", "STARTED", "COMPLETED", "EXPIRED"] as const).map((s) => (
          <Badge key={s} tone={STATUS_TONE[s]}>
            {s[0] + s.slice(1).toLowerCase()} · <span className="font-mono">{counts[s] ?? 0}</span>
          </Badge>
        ))}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={remind} disabled={busy}>
            Remind non-starters
          </Button>
          <Button variant="primary" onClick={previewClosing} disabled={busy}>
            Closing-soon email…
          </Button>
        </div>
      </div>

      {/* Preview before sending — this reaches everyone who hasn't finished,
          which is usually most of the list. */}
      {closingPreview && (
        <div className="mb-5 rounded border border-hairline bg-surface p-4">
          <p className="text-sm font-semibold mb-1">Send the closing-soon email?</p>
          <p className="text-xs text-muted mb-3">
            Goes to <span className="font-semibold text-ink">{closingPreview.wouldEmail}</span> of{" "}
            {closingPreview.total} invited —{" "}
            <span className="font-mono">{closingPreview.notStarted}</span> never started,{" "}
            <span className="font-mono">{closingPreview.startedUnfinished}</span> started but unfinished.{" "}
            The <span className="font-mono">{closingPreview.finished}</span> who already finished are excluded.
          </p>
          <div className="max-h-40 overflow-y-auto rounded border border-hairline bg-paper px-3 py-2 mb-3">
            {closingPreview.recipients.map((r) => (
              <div key={r.email} className="text-xs font-mono text-muted">
                {r.started ? "· started " : "· not started "} {r.name ? `${r.name} — ` : ""}{r.email}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={sendClosing} disabled={busy}>
              {busy ? "Sending…" : `Send to ${closingPreview.wouldEmail}`}
            </Button>
            <Button variant="secondary" onClick={() => setClosingPreview(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {invites.length === 0 ? (
        <EmptyState title="No invitations sent yet" description="Upload a candidate file above to send tracked invitation links." />
      ) : (
        <Table>
          <Thead>
            <Tr>
              {["Candidate", "Email", "GitHub", "Status", "Score"].map((h, i) => (
                <Th key={h} numeric={i === 4}>{h}</Th>
              ))}
            </Tr>
          </Thead>
          <tbody>
            {invites.map((i) => (
              <Tr key={i.id}>
                <Td>{i.name ?? "—"}</Td>
                <Td className="text-muted">{i.email}</Td>
                <Td className="text-muted">{i.githubUsername ?? "—"}</Td>
                <Td><Badge tone={STATUS_TONE[i.status]}>{i.status[0] + i.status.slice(1).toLowerCase()}</Badge></Td>
                <Td numeric className="font-bold">{i.score ?? "—"}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

function Banner({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  const ok = tone === "ok";
  return (
    <div
      className="rounded border px-3.5 py-2.5 text-sm mb-4"
      style={{
        background: ok ? "rgba(11,122,94,0.06)" : "rgba(179,55,47,0.06)",
        borderColor: ok ? "rgba(11,122,94,0.25)" : "rgba(179,55,47,0.25)",
        color: ok ? "var(--verified)" : "var(--signal-red)",
      }}
    >
      {children}
    </div>
  );
}
