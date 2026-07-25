"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { storeToken } from "@/lib/auth";
import { BoltIcon } from "@/components/Logo";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function VerifyInner() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("token");
    if (!token) { setError("Missing sign-in token."); return; }
    fetch(`${API}/auth/employer/verify`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j.data?.token) throw new Error(j.error ?? "Verification failed");
        storeToken(j.data.token);
        window.location.href = j.data.hasOrg ? "/employer/dashboard" : "/employer/signup";
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Verification failed"));
  }, [params]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="text-center">
        <BoltIcon size={44} />
        {error ? (
          <>
            <h1 className="font-display text-xl font-bold mt-4 mb-2">Sign-in failed</h1>
            <p className="text-sm text-red">{error}</p>
            <a href="/employer/signin" className="text-sm mt-4 inline-block text-brand hover:underline">Request a new link</a>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-bold mt-4 mb-2">Signing you in…</h1>
          </>
        )}
      </div>
    </div>
  );
}

export default function EmployerVerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper flex items-center justify-center text-sm text-muted">Loading…</div>}>
      <VerifyInner />
    </Suspense>
  );
}
