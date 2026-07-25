"use client";

import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

const ENGAGEMENT_LABEL: Record<"HIRING" | "TRAINING", { title: string; body: string }> = {
  HIRING: { title: "Hiring", body: "Assess and rank candidates for open roles." },
  TRAINING: { title: "Training", body: "Run assessments for internal upskilling and cohorts." },
};

export default function EmployerSignupPage(): React.ReactElement {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [plan, setPlan] = useState<"HIRING" | "TRAINING">("HIRING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const token = getToken();
    if (!token) { router.push("/"); return; }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
      const res = await axios.post(
        `${apiUrl}/organisations`,
        { name, domain: domain || undefined, plan },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const orgId = res.data.data.id as string;
      if (typeof window !== "undefined") {
        localStorage.setItem("ds_org_id", orgId);
      }
      router.push("/employer/dashboard");
    } catch {
      setError("Failed to create organisation. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col items-center justify-center px-6">
      <Link href="/" className="mb-10"><Logo variant="horizontal" size={32} /></Link>

      <Card className="w-full max-w-md p-8">
        <h1 className="font-display text-2xl font-bold mb-1">Create your organisation</h1>
        <p className="text-sm text-muted mb-6">Set up your employer account to start assessing candidates.</p>

        {error && (
          <div className="mb-4 rounded border px-4 py-3 text-sm text-red" style={{ background: "rgba(179,55,47,0.05)", borderColor: "rgba(179,55,47,0.25)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Field label="Company name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Acme Corp" />
          </Field>

          <Field label="Company domain (optional)">
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acmecorp.com" />
          </Field>

          <Field label="What are you using DevSimulate for?">
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(ENGAGEMENT_LABEL) as Array<"HIRING" | "TRAINING">).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlan(p)}
                  className={`rounded border px-4 py-3 text-left text-sm transition-colors duration-150 ${
                    plan === p ? "border-emerald bg-emerald-weak" : "border-hairline bg-surface hover:bg-paper"
                  }`}
                >
                  <div className={`font-semibold ${plan === p ? "text-emerald" : "text-ink"}`}>{ENGAGEMENT_LABEL[p].title}</div>
                  <div className="text-xs text-muted mt-0.5">{ENGAGEMENT_LABEL[p].body}</div>
                </button>
              ))}
            </div>
          </Field>

          <Button type="submit" variant="primary" disabled={loading || !name} className="w-full mt-2">
            {loading ? "Creating…" : "Create organisation"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
