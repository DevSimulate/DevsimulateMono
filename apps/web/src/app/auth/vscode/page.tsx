"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BoltIcon } from "@/components/Logo";

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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="text-red-400 font-semibold">No authorization code received from GitHub.</div>
        <a href="/" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
          Back to home
        </a>
      </div>
    );
  }

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
        onClick={copyCode}
        className="px-6 py-2 bg-brand-500 hover:bg-brand-400 text-white rounded-lg text-sm font-semibold transition-colors"
      >
        {copied ? "Copied!" : "Copy Code"}
      </button>

      <p className="text-xs text-slate-600 max-w-xs">
        Switch back to VS Code — a prompt should be waiting for this code.
      </p>
    </div>
  );
}

export default function VsCodeCallbackPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-400">
          Loading…
        </div>
      }
    >
      <VsCodeCallbackHandler />
    </Suspense>
  );
}
