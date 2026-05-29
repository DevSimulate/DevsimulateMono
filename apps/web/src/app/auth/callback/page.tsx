"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { storeToken } from "@/lib/auth";
import { BoltIcon } from "@/components/Logo";
import { LoginResponse } from "@devsimulate/shared";

function CallbackHandler(): React.ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = params.get("code");
  const state = params.get("state");
  const isVsCode = state === "vscode";

  useEffect(() => {
    // VS Code flow — just display the code, do not exchange it here
    if (isVsCode) return;

    if (!code) {
      setError("No authorization code received from GitHub.");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

    axios
      .post<{ data: LoginResponse }>(`${apiUrl}/auth/github`, { code })
      .then((res) => {
        storeToken(res.data.data.token);
        const returnUrl = localStorage.getItem("ds_submit_return");
        if (returnUrl) {
          localStorage.removeItem("ds_submit_return");
          window.location.replace(returnUrl);
        } else {
          router.push("/dashboard");
        }
      })
      .catch(() => {
        setError(
          "Login failed. The GitHub code may have expired — please try again."
        );
      });
  }, [code, isVsCode, params, router]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="text-red-400 font-semibold">{error}</div>
        <a href="/" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
          Back to home
        </a>
      </div>
    );
  }

  // VS Code flow — show the code for the user to paste back into VS Code
  if (isVsCode && code) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-6">
        <BoltIcon size={52} />
        <h1 className="text-xl font-bold text-white">Almost there!</h1>
        <p className="text-slate-400 text-sm max-w-sm">
          Copy the code below and paste it into the VS Code input box that appeared.
        </p>
        <div className="bg-slate-800 border border-slate-600 rounded-lg px-6 py-4 w-full max-w-sm">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-widest">Your code</p>
          <p className="font-mono text-lg text-white break-all select-all">{code}</p>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="px-6 py-2 bg-brand-500 hover:bg-brand-400 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {copied ? "Copied!" : "Copy Code"}
        </button>
        <p className="text-xs text-slate-600 max-w-xs">
          Switch back to VS Code — a prompt is waiting for this code.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-400">
      Logging you in…
    </div>
  );
}

export default function AuthCallbackPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-400">
          Loading…
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
