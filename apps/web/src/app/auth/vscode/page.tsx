"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BoltIcon } from "@/components/Logo";
import { Button } from "@/components/ui/Button";

function VsCodeCallbackHandler(): React.ReactElement {
  const params = useSearchParams();
  const code = params.get("code");
  const [copied, setCopied] = useState(false);

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!code) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="text-red font-semibold text-sm">No authorization code received from GitHub.</div>
        <a href="/" className="text-sm text-brand hover:underline">
          Back to home
        </a>
      </div>
    );
  }

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

      <Button variant="primary" onClick={copyCode}>
        {copied ? "Copied!" : "Copy code"}
      </Button>

      <p className="text-xs text-muted max-w-xs">
        Switch back to VS Code — a prompt should be waiting for this code.
      </p>
    </div>
  );
}

export default function VsCodeCallbackPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper flex items-center justify-center text-sm text-muted">
          Loading…
        </div>
      }
    >
      <VsCodeCallbackHandler />
    </Suspense>
  );
}
