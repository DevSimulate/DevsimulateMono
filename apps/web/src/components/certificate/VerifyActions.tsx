"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function VerifyActions({ url }: { url: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Button variant="secondary" onClick={copyLink}>
      {copied ? "✓ Copied" : "Copy link"}
    </Button>
  );
}
