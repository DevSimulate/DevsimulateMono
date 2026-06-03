"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getToken } from "@/lib/auth";
import { BoltIcon } from "@/components/Logo";

const GITHUB_AUTH_URL =
  `https://github.com/login/oauth/authorize` +
  `?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}` +
  `&scope=read:user,user:email,public_repo` +
  `&redirect_uri=${encodeURIComponent(
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com") + "/auth/callback"
  )}`;

/**
 * Guards the employer area. If the visitor has no token, show a sign-in screen
 * instead of an empty dashboard. Sign-in uses the same GitHub OAuth as the rest
 * of the platform, then returns to the employer page they were heading to.
 */
export default function EmployerAuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(!!getToken());
  }, []);

  function signIn() {
    localStorage.setItem("ds_submit_return", pathname);
    window.location.href = GITHUB_AUTH_URL;
  }

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a", color: "#555" }}>
        Loading…
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0a0a0a" }}>
        <div className="max-w-md w-full rounded-2xl p-8 text-center" style={{ background: "#111111", border: "1px solid #222222" }}>
          <div className="flex items-center justify-center gap-2 mb-6">
            <BoltIcon size={30} />
            <span className="font-black text-white">DevSimulate</span>
          </div>
          <div className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block mb-4"
            style={{ background: "#1e1b4b", color: "#818cf8" }}>
            Employer Portal
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Sign in to continue</h1>
          <p className="text-sm leading-relaxed mb-6" style={{ color: "#aaaaaa" }}>
            Access your hiring campaigns, review candidate scores, and invite top performers to interviews.
          </p>
          <button onClick={signIn}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-bold text-white"
            style={{ background: "#24292e" }}>
            Sign in with GitHub
          </button>
          <p className="text-xs mt-4" style={{ color: "#555" }}>
            Employer access is invite-only. Want a demo?{" "}
            <a href="mailto:ossama@devsimulate.com" style={{ color: "#818cf8" }}>Contact us</a>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
