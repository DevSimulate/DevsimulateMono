"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { BoltIcon } from "@/components/Logo";
import { Button } from "@/components/ui/Button";

const GITHUB_AUTH_URL =
  `https://github.com/login/oauth/authorize` +
  `?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}` +
  `&scope=read:user,user:email,public_repo` +
  `&redirect_uri=${encodeURIComponent(
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com") +
    "/auth/callback"
  )}` +
  `&state=vscode-link`;

export default function VsCodeLinkPage(): React.ReactElement {
  const [status, setStatus] = useState<"checking" | "code" | "error">("checking");
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();

    if (!token) {
      localStorage.setItem("ds_submit_return", "/auth/vscode-link");
      window.location.href = GITHUB_AUTH_URL;
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://devsimulateapi-production.up.railway.app";

    fetch(`${apiUrl}/auth/vscode-link-token`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((body: { data?: { token: string }; error?: string }) => {
        if (!body.data?.token) throw new Error(body.error ?? "Failed to generate link token");
        setLinkToken(body.data.token);
        setStatus("code");

        // Also try the vscode:// deep link as a fast path
        window.location.href = `vscode://devsimulate-app.devsimulate/auth?token=${encodeURIComponent(body.data.token)}`;
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
        setStatus("error");
      });
  }, []);

  function handleCopy() {
    if (!linkToken) return;
    navigator.clipboard.writeText(linkToken).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-6 text-center px-6">
      <BoltIcon size={52} />

      {status === "checking" && (
        <h1 className="font-display text-xl font-bold text-ink">Checking your session…</h1>
      )}

      {status === "code" && linkToken && (
        <>
          <h1 className="font-display text-xl font-bold text-ink">Connect VS Code</h1>
          <p className="text-sm text-muted max-w-sm">
            VS Code should open automatically. If it doesn&apos;t, copy this code and paste it in VS Code when prompted.
          </p>

          <div className="rounded border border-hairline bg-surface px-6 py-5 w-full max-w-sm">
            <p className="text-xs text-muted mb-2 uppercase tracking-widest">Your connection code</p>
            <p className="font-mono text-xs text-ink break-all select-all leading-relaxed">{linkToken}</p>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-sm">
            <Button variant="primary" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy code"}
            </Button>
            <p className="text-xs text-muted">
              In VS Code: open Command Palette → <span className="text-ink">DevSimulate: Paste Connection Code</span>
            </p>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <h1 className="font-display text-xl font-bold text-ink">Connection failed</h1>
          <p className="text-sm text-red max-w-sm">{error}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>Try again</Button>
        </>
      )}
    </div>
  );
}
