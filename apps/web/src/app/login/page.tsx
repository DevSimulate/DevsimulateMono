"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import { BoltIcon } from "@/components/Logo";

const GITHUB_AUTH_URL =
  `https://github.com/login/oauth/authorize` +
  `?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}` +
  `&scope=read:user,user:email,public_repo` +
  `&redirect_uri=${encodeURIComponent(
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com") + "/auth/callback"
  )}`;

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  useEffect(() => {
    if (getToken()) router.replace(next);
  }, [next, router]);

  function signIn() {
    localStorage.setItem("ds_submit_return", next);
    window.location.href = GITHUB_AUTH_URL;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0a0a0a" }}>
      <div className="max-w-sm w-full">
        <div className="rounded-2xl p-8 text-center" style={{ background: "#111111", border: "1px solid #222222" }}>
          <div className="flex justify-center mb-5">
            <BoltIcon size={40} />
          </div>
          <h1 className="text-xl font-black text-white mb-2">Sign in to DevSimulate</h1>
          <p className="text-sm mb-6" style={{ color: "#888" }}>
            Use your GitHub account to sign in and access your assigned tickets.
          </p>
          <button
            onClick={signIn}
            className="flex items-center justify-center gap-2.5 w-full py-3 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "#24292e" }}
          >
            <svg height="18" viewBox="0 0 16 16" fill="white" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Sign in with GitHub
          </button>
          <p className="text-xs mt-4" style={{ color: "#444" }}>
            Free · No credit card required
          </p>
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-5">
          <BoltIcon size={14} />
          <span className="text-xs" style={{ color: "#555" }}>
            Powered by <span className="font-bold" style={{ color: "#888" }}>DevSimulate</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a", color: "#888" }}>Loading…</div>}>
      <LoginContent />
    </Suspense>
  );
}
