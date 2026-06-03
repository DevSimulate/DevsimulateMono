"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { BoltIcon } from "@/components/Logo";

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
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-6"
      style={{ background: "#0f172a" }}>
      <BoltIcon size={52} />

      {status === "checking" && (
        <>
          <h1 className="text-xl font-bold text-white">Checking your session…</h1>
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </>
      )}

      {status === "code" && linkToken && (
        <>
          <h1 className="text-xl font-bold text-white">Connect VS Code</h1>
          <p className="text-slate-400 text-sm max-w-sm">
            VS Code should open automatically. If it doesn&apos;t, copy this code and paste it in VS Code when prompted.
          </p>

          <div className="bg-slate-800 border border-slate-600 rounded-xl px-6 py-5 w-full max-w-sm">
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-widest">Your connection code</p>
            <p className="font-mono text-xs text-white break-all select-all leading-relaxed">{linkToken}</p>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-sm">
            <button
              onClick={handleCopy}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {copied ? "Copied!" : "Copy Code"}
            </button>
            <p className="text-xs text-slate-500">
              In VS Code: open Command Palette → <span className="text-slate-300">DevSimulate: Paste Connection Code</span>
            </p>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <h1 className="text-xl font-bold text-white">Connection failed</h1>
          <p className="text-red-400 text-sm max-w-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Try again
          </button>
        </>
      )}
    </div>
  );
}
