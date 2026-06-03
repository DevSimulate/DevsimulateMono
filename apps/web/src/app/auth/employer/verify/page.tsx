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
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0a0a0a" }}>
      <div className="text-center">
        <BoltIcon size={44} />
        {error ? (
          <>
            <h1 className="text-xl font-bold text-white mt-4 mb-2">Sign-in failed</h1>
            <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>
            <a href="/employer/signin" className="text-sm mt-4 inline-block" style={{ color: "#818cf8" }}>Request a new link</a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white mt-4 mb-2">Signing you in…</h1>
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </>
        )}
      </div>
    </div>
  );
}

export default function EmployerVerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a", color: "#555" }}>Loading…</div>}>
      <VerifyInner />
    </Suspense>
  );
}
