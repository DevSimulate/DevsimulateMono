"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { BoltIcon } from "@/components/Logo";

const GITHUB_AUTH_URL =
  `https://github.com/login/oauth/authorize` +
  `?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}` +
  `&scope=read:user,user:email` +
  `&redirect_uri=${encodeURIComponent(
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com") +
    "/auth/callback"
  )}` +
  `&state=vscode-link`;

export default function VsCodeLinkPage(): React.ReactElement {
  const [status, setStatus] = useState<"checking" | "redirecting" | "error">("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();

    if (!token) {
      localStorage.setItem("ds_submit_return", "/auth/vscode-link");
      window.location.href = GITHUB_AUTH_URL;
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://devsimulateapi-production.up.railway.app";

    setStatus("redirecting");

    fetch(`${apiUrl}/auth/vscode-link-token`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((body: { data?: { token: string }; error?: string }) => {
        if (!body.data?.token) throw new Error(body.error ?? "Failed to generate link token");
        const vsUri = `vscode://devsimulate.devsimulate/auth?token=${body.data.token}`;
        window.location.href = vsUri;
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
        setStatus("error");
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-6"
      style={{ background: "#0f172a" }}>
      <BoltIcon size={52} />

      {status === "checking" || status === "redirecting" ? (
        <>
          <h1 className="text-xl font-bold text-white">Connecting to VS Code…</h1>
          <p className="text-slate-400 text-sm max-w-sm">
            {status === "checking"
              ? "Checking your session…"
              : "Opening VS Code. If nothing happens, make sure the DevSimulate extension is installed."}
          </p>
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </>
      ) : (
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
