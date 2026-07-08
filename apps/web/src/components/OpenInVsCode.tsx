"use client";

import { useCallback, useState } from "react";
import { getToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const EXT_ID = "devsimulate-app.devsimulate";
const DEEP_LINK = (assignmentId: string, code?: string) =>
  `vscode://${EXT_ID}/clone?assignmentId=${encodeURIComponent(assignmentId)}` +
  (code ? `&code=${encodeURIComponent(code)}` : "");

/**
 * Trades the current session for a short-lived handoff code so the extension
 * can authenticate as THIS exact account — guaranteeing the assignment resolves.
 * Returns undefined on failure (the deep link still works if the extension is
 * already connected to the right account).
 */
async function fetchHandoffCode(): Promise<string | undefined> {
  const token = getToken();
  if (!token) return undefined;
  try {
    const res = await fetch(`${API_URL}/auth/handoff`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const j = await res.json();
    return j.data?.code as string | undefined;
  } catch {
    return undefined;
  }
}
// Opens the extension's page inside VS Code (Extensions view) so the user can
// click Install. Falls back to the web marketplace listing if VS Code isn't
// installed at all.
const VSCODE_INSTALL_LINK = `vscode:extension/${EXT_ID}`;
const MARKETPLACE_URL = `https://marketplace.visualstudio.com/items?itemName=${EXT_ID}`;

interface Props {
  assignmentId: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * "Open in VS Code" button that gracefully handles the extension not being
 * installed. It fires the vscode:// deep link, and — if the browser never loses
 * focus (i.e. nothing opened) — shows an install prompt. A small persistent
 * "Install the extension" link covers the case where VS Code is installed but
 * the extension isn't (VS Code steals focus but the deep link does nothing).
 */
export function OpenInVsCode({ assignmentId, className, style }: Props) {
  const [showInstall, setShowInstall] = useState(false);

  const open = useCallback(async () => {
    // Include a handoff code so the extension logs in as this exact account.
    const code = await fetchHandoffCode();

    let switchedAway = false;
    const onHide = () => {
      if (document.hidden) switchedAway = true;
    };
    document.addEventListener("visibilitychange", onHide);

    // Fire the deep link.
    window.location.href = DEEP_LINK(assignmentId, code);

    // If focus never left the browser after a moment, nothing handled the link
    // (VS Code not installed) — offer to install.
    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", onHide);
      if (!switchedAway && !document.hidden) setShowInstall(true);
    }, 1500);
  }, [assignmentId]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={open} className={className} style={style}>
        ⚡ Open in VS Code
      </button>

      <button
        type="button"
        onClick={() => setShowInstall(true)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          fontSize: "11px",
          color: "#8888aa",
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Extension not installed? Install it
      </button>

      {showInstall && (
        <InstallModal assignmentId={assignmentId} onRetry={open} onClose={() => setShowInstall(false)} />
      )}
    </div>
  );
}

function InstallModal({
  assignmentId,
  onRetry,
  onClose,
}: {
  assignmentId: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "440px",
          width: "100%",
          background: "#141419",
          border: "1px solid #2a2a35",
          borderRadius: "14px",
          padding: "24px",
          color: "#e8e8f0",
          textAlign: "left",
        }}
      >
        <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "6px" }}>
          Install the DevSimulate extension
        </div>
        <div style={{ fontSize: "13px", color: "#a0a0b0", lineHeight: 1.6, marginBottom: "18px" }}>
          To open tickets in VS Code you need the DevSimulate extension. It only takes a few seconds.
        </div>

        <ol style={{ fontSize: "13px", color: "#c8c8d4", lineHeight: 1.7, paddingLeft: "18px", marginBottom: "20px" }}>
          <li>
            Click <strong>Install extension</strong> below — it opens the DevSimulate extension in VS Code.
          </li>
          <li>Press <strong>Install</strong> in VS Code.</li>
          <li>
            Come back here and click <strong>Open in VS Code</strong> again.
          </li>
        </ol>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <a
            href={VSCODE_INSTALL_LINK}
            style={{
              display: "block",
              textAlign: "center",
              padding: "10px",
              background: "#5B5BD6",
              color: "#fff",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Install extension in VS Code
          </a>

          <a
            href={MARKETPLACE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              textAlign: "center",
              padding: "9px",
              background: "transparent",
              color: "#a0a0ff",
              border: "1px solid #2a2a35",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Or view it on the Marketplace (if VS Code isn't installed)
          </a>

          <button
            type="button"
            onClick={() => {
              onClose();
              onRetry();
            }}
            style={{
              padding: "9px",
              background: "transparent",
              color: "#e8e8f0",
              border: "1px solid #2a2a35",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            I&apos;ve installed it — Open in VS Code
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: "12px",
            width: "100%",
            background: "none",
            border: "none",
            color: "#666",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
