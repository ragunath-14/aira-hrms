"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckIcon, CopyIcon, SendIcon, TriangleAlertIcon, WebhookIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorText } from "@/lib/format/error-text";

type Endpoint = {
  url: string;
  enabled: boolean;
  consecutiveFailures: number;
  secretHint: string;
};

type Delivery = {
  id: string;
  event: string;
  status: string;
  attempts: number;
  responseStatus: number | null;
  lastError: string | null;
  createdAt: string;
};

const TONE: Record<string, string> = {
  delivered: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-rose-100 text-rose-700",
};

// Where AIRA tells the company's own system about new applications and stage
// changes. Owners and admins only.
export function WebhookPanel() {
  const [allowed, setAllowed] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/webhooks");

    if (res.status === 403) {
      setAllowed(false);
      return;
    }

    const json = await res.json().catch(() => null);

    if (res.ok && json) {
      setEndpoint(json.endpoint);
      setDeliveries(json.deliveries);
      if (json.endpoint) setUrl((current) => current || json.endpoint.url);
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function call(method: string, path: string, body?: object) {
    setBusy(true);
    setError("");

    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(errorText(json.error, "Something went wrong"));

      return json;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save(rotateSecret = false) {
    const json = await call("PUT", "/api/webhooks", { url: url.trim(), rotateSecret });

    if (!json) return;

    if (json.secret) {
      setSecret(json.secret);
      setCopied(false);
    }

    toast.success("Webhook saved");
    await load();
  }

  async function test() {
    const json = await call("POST", "/api/webhooks/test");

    if (!json) return;

    if (json.ok) toast.success(`The test arrived (answered ${json.status})`);
    else toast.error(`The test did not arrive: ${json.error ?? "no answer"}`);

    await load();
  }

  async function retry(id: string) {
    const json = await call("POST", `/api/webhooks/deliveries/${id}`);

    if (json) toast[json.status === "delivered" ? "success" : "error"](json.status === "delivered" ? "Delivered" : `Still failing: ${json.lastError ?? "no answer"}`);

    await load();
  }

  async function toggle(enabled: boolean) {
    if (await call("PATCH", "/api/webhooks", { enabled })) await load();
  }

  async function remove() {
    if (await call("DELETE", "/api/webhooks")) {
      setUrl("");
      toast.success("Webhook removed");
      await load();
    }
  }

  async function copySecret() {
    if (!secret) return;

    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      toast.error("Could not copy. Select the secret and copy it by hand.");
    }
  }

  if (!allowed || !loaded) return null;

  return (
    <div className="space-y-3 border-t px-6 py-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <WebhookIcon className="size-4" /> Webhook (AIRA tells your system)
        </h3>
        <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
          AIRA calls this address when someone applies (<code>application.created</code>) and when the team moves an
          applicant to another stage (<code>application.stage_changed</code>). Each call is signed with a secret so you
          can check it came from AIRA, and failed calls are retried.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-64 flex-1">
          <Label htmlFor="wh-url" className="mb-1.5">Address (https)</Label>
          <Input id="wh-url" placeholder="https://yourcompany.com/hooks/aira" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <Button type="button" disabled={busy || url.trim() === ""} onClick={() => save(false)}>
          {endpoint ? "Update webhook" : "Save webhook"}
        </Button>
        {endpoint && (
          <>
            <Button type="button" variant="outline" disabled={busy} onClick={test}>
              <SendIcon /> Send test
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => toggle(!endpoint.enabled)}>
              {endpoint.enabled ? "Pause" : "Resume"}
            </Button>
            <Button type="button" variant="ghost" className="text-destructive" disabled={busy} onClick={remove}>
              Remove
            </Button>
          </>
        )}
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      {endpoint && !endpoint.enabled && (
        <p className="flex items-center gap-2 text-xs text-amber-700">
          <TriangleAlertIcon className="size-4" /> Paused
          {endpoint.consecutiveFailures >= 20 ? " because your address failed 20 times in a row" : ""}. Nothing is being sent.
        </p>
      )}

      {secret && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 flex items-start gap-2 text-xs text-amber-900">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            Copy your signing secret now. It is shown only once; if you lose it, generate a new one.
          </p>
          <div className="flex items-start gap-2">
            <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded border bg-background px-3 py-2 text-xs" data-testid="webhook-secret">{secret}</pre>
            <Button type="button" variant="outline" size="sm" onClick={copySecret}>
              {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy"}
            </Button>
            <Button type="button" size="sm" onClick={() => setSecret(null)}>Done</Button>
          </div>
        </div>
      )}

      {endpoint && !secret && (
        <p className="text-xs text-muted-foreground">
          Secret ends in <code>…{endpoint.secretHint}</code>.{" "}
          <button type="button" className="font-medium text-primary hover:underline" disabled={busy} onClick={() => save(true)}>
            Generate a new secret
          </button>
        </p>
      )}

      {deliveries.length > 0 && (
        <ul className="divide-y rounded-lg border text-xs">
          {deliveries.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 font-medium ${TONE[d.status] ?? ""}`}>{d.status}</span>
                <code>{d.event}</code>
                <span className="text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</span>
              </span>
              <span className="flex items-center gap-2 text-muted-foreground">
                {d.responseStatus ? `HTTP ${d.responseStatus}` : d.lastError}
                {d.attempts > 1 && ` · ${d.attempts} tries`}
                {d.status !== "delivered" && (
                  <Button type="button" variant="outline" size="xs" disabled={busy} onClick={() => retry(d.id)}>
                    Retry now
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
