"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { storeToken } from "@/lib/auth";
import { BoltIcon } from "@/components/Logo";
import { LoginResponse } from "@devsimulate/shared";
import { Button } from "@/components/ui/Button";

function CallbackHandler(): React.ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = params.get("code");
  const state = params.get("state");
  const isVsCode = state === "vscode";
  const isVsCodeLink = state === "vscode-link";

  useEffect(() => {
    // Legacy VS Code flow — just display the code, do not exchange it here
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
        if (isVsCodeLink) {
          // After OAuth, continue the VS Code deep-link flow
          window.location.replace("/auth/vscode-link");
          return;
        }
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
  }, [code, isVsCode, isVsCodeLink, params, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="text-red font-semibold text-sm">{error}</div>
        <a href="/" className="text-sm text-brand hover:underline">
          Back to home
        </a>
      </div>
    );
  }

  // VS Code flow — show the code for the user to paste back into VS Code
  if (isVsCode && code) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-6 text-center px-6">
        <BoltIcon size={52} />
        <h1 className="font-display text-xl font-bold text-ink">Almost there!</h1>
        <p className="text-sm text-muted max-w-sm">
          Copy the code below and paste it into the VS Code input box that appeared.
        </p>
        <div className="rounded border border-hairline bg-surface px-6 py-4 w-full max-w-sm">
          <p className="text-xs text-muted mb-2 uppercase tracking-widest">Your code</p>
          <p className="font-mono text-lg text-ink break-all select-all">{code}</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            navigator.clipboard.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? "Copied!" : "Copy code"}
        </Button>
        <p className="text-xs text-muted max-w-xs">
          Switch back to VS Code — a prompt is waiting for this code.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center text-sm text-muted">
      Logging you in…
    </div>
  );
}

export default function AuthCallbackPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper flex items-center justify-center text-sm text-muted">
          Loading…
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
