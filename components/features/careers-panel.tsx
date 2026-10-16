"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon, PlugIcon } from "lucide-react";
import { toast } from "sonner";

import { ApiKeysPanel } from "@/components/features/api-keys-panel";
import { WebhookPanel } from "@/components/features/webhook-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Connects the company's own website to AIRA through the API: the website's
// server reads the openings marked Published and sends applications, which
// arrive on the board below. Everything is done with API keys.
export function CareersPanel() {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // A website's server cannot reach an address that only exists on this
  // computer, and keys must travel over https.
  const notLive = origin !== "" && (/^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(origin) || !origin.startsWith("https://"));
  const base = `${origin}/api/v1`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(base);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy. Select the address and copy it by hand.");
    }
  }

  return (
    <Card className="mb-6 gap-0 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PlugIcon className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Website connection (API)</h2>
            <p className="max-w-2xl text-xs text-muted-foreground">
              Openings you mark <strong>Published</strong> are returned to your website&apos;s server through the API, and
              applications it sends arrive below. Create a key, give it to your website developer, and keep it on the
              server.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <code className="rounded-lg border bg-muted/40 px-3 py-2 text-xs">{base}</code>
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      {notLive && (
        <p className="border-t bg-amber-50 px-6 py-3 text-xs text-amber-900" role="note">
          You are viewing AIRA at <code>{origin}</code>, which your website cannot reach. Open AIRA at its live https
          address to copy the API address and create keys; the ones here only work on this computer.
        </p>
      )}

      <ApiKeysPanel />
      <WebhookPanel />
    </Card>
  );
}
