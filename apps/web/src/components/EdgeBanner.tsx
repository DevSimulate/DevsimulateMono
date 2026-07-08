"use client";

import { useEffect, useState } from "react";

/**
 * A soft, dismissible banner shown when the candidate is NOT using Microsoft
 * Edge. The assessment flow (camera + microphone + speech recognition for the
 * verbal defence) is only reliable in Edge, so we recommend switching — but do
 * not block them. The "Open in Edge" button reopens the current URL via the
 * microsoft-edge: protocol (Windows).
 */
export function EdgeBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Chromium Edge reports "Edg/" in its user agent. (Legacy Edge used "Edge/".)
    const ua = navigator.userAgent;
    const isEdge = /\bEdg(e|A|iOS)?\//.test(ua);
    if (!isEdge) setShow(true);
  }, []);

  if (!show) return null;

  function openInEdge() {
    // The microsoft-edge: protocol opens the same page in Edge on Windows.
    window.location.href = `microsoft-edge:${window.location.href}`;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 16px",
        background: "#fffbeb",
        borderBottom: "1px solid #fde68a",
        color: "#92400e",
        fontSize: "14px",
        lineHeight: 1.4,
        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
      }}
    >
      <span style={{ flex: 1 }}>
        For the best experience, open this page in <strong>Microsoft Edge</strong>.
        Camera, microphone and voice recording work most reliably there.
      </span>
      <button
        onClick={openInEdge}
        style={{
          flexShrink: 0,
          padding: "6px 14px",
          background: "#0f6cbd",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Open in Edge
      </button>
      <button
        onClick={() => setShow(false)}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          color: "#92400e",
          fontSize: "18px",
          lineHeight: 1,
          cursor: "pointer",
          padding: "2px 6px",
        }}
      >
        ×
      </button>
    </div>
  );
}
