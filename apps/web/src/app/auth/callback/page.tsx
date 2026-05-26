"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { storeToken } from "@/lib/auth";
import { LoginResponse } from "@devsimulate/shared";

function CallbackHandler(): React.ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");

    if (!code) {
      setError("No authorization code received from GitHub.");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

    axios
      .post<{ data: LoginResponse }>(`${apiUrl}/auth/github`, { code })
      .then((res) => {
        storeToken(res.data.data.token);
        router.push("/dashboard");
      })
      .catch(() => {
        setError(
          "Login failed. The GitHub code may have expired — please try again."
        );
      });
  }, [params, router]);

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
