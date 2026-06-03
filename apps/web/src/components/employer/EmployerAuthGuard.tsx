"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

/**
 * Guards the employer area. Employers sign in with email (magic link) — NOT
 * GitHub — because recruiters/managers may not have a GitHub account. If there's
 * no session, send them to the employer sign-in page.
 */
export default function EmployerAuthGuard({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      window.location.href = "/auth/employer/signin";
      return;
    }
    setAuthed(true);
  }, []);

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a", color: "#555" }}>
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
