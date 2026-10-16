"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckIcon, CopyIcon, KeyRoundIcon, PlusIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { selectClass } from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { API_SCOPES, DEFAULT_API_SCOPES, KEY_EXPIRY_CHOICES } from "@/lib/config/api-scopes";
import { errorText } from "@/lib/format/error-text";

type Key = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  allowedIps: string[];
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

const scopeLabel = (id: string) => API_SCOPES.find((s) => s.id === id)?.label ?? id;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "never");

// API keys for the company's own website or software. Owners and admins only:
// the keys open the door to applicant data, so HR users do not see this panel.
export function ApiKeysPanel() {
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [max, setMax] = useState(10);
  const [now, setNow] = useState(0);
  const [allowed, setAllowed] = useState(true);
  const [origin, setOrigin] = useState("");

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(DEFAULT_API_SCOPES);
  const [expiry, setExpiry] = useState("90");
  const [ips, setIps] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<Key | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/api-keys");

    if (res.status === 403) {
      setAllowed(false);
      return;
    }

    const json = await res.json().catch(() => null);

    if (res.ok && json) {
      setKeys(json.keys);
      setNow(Date.now());
      setMax(json.max);
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          scopes,
          expiresInDays: expiry === "never" ? null : Number(expiry),
          allowedIps: ips.split(/[\s,]+/).filter(Boolean),
        }),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(errorText(json.error, "Failed to create the key"));

      setOpen(false);
      setCreated(json.key);
      setCopied(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create the key");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(key: Key) {
    const res = await fetch(`/api/api-keys/${key.id}`, { method: "DELETE" });

    if (!res.ok) {
      toast.error(errorText((await res.json().catch(() => null))?.error, "Failed to revoke the key"));
    } else {
      toast.success("Key revoked. Anything using it has stopped working.");
    }

    await load();
  }

  async function copyKey() {
    if (!created) return;

    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
    } catch {
      toast.error("Could not copy. Select the key and copy it by hand.");
    }
  }

  if (!allowed || keys === null) return null;

  const example = `curl ${origin}/api/v1/jobs \\\n  -H "Authorization: Bearer YOUR_KEY"`;

  return (
    <div className="space-y-3 border-t px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <KeyRoundIcon className="size-4" /> API keys (for your website&apos;s server)
          </h3>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            Use a key when your own server or software should read your openings or send applications. Keep it on
            your server only, never in web page code. Each key has only the permissions you give it, and can
            expire or be revoked at any time.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={keys.length >= max}
          onClick={() => {
            setName("");
            setScopes(DEFAULT_API_SCOPES);
            setExpiry("90");
            setIps("");
            setFormError("");
            setOpen(true);
          }}
        >
          <PlusIcon /> New key
        </Button>
      </div>

      {keys.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">No API keys yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {keys.map((k) => {
            const expired = k.expiresAt ? new Date(k.expiresAt).getTime() <= now : false;

            return (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {k.name} <code className="ml-1 text-xs text-muted-foreground">{k.prefix}…</code>
                    {expired && (
                      <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Expired</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{k.scopes.map(scopeLabel).join(" · ")}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {when(k.createdAt)} · Last used {when(k.lastUsedAt)} · {k.expiresAt ? `Expires ${when(k.expiresAt)}` : "No expiry"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {k.allowedIps.length > 0 ? `Only from ${k.allowedIps.join(", ")}` : "Works from any address"}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setRevoking(k)}>
                  <Trash2Icon /> Revoke
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border bg-muted/40 px-3 py-2 text-xs">{example}</pre>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New API key</DialogTitle>
            <DialogDescription>Give it only the permissions it needs. The key is shown once, right after you create it.</DialogDescription>
          </DialogHeader>

          <form onSubmit={create} className="space-y-4">
            <div>
              <Label htmlFor="key-name" className="mb-1.5">Name</Label>
              <Input id="key-name" required maxLength={60} placeholder="e.g. Company website" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Permissions</legend>
              {API_SCOPES.map((s) => (
                <label key={s.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-primary"
                    checked={scopes.includes(s.id)}
                    onChange={(e) => setScopes(e.target.checked ? [...scopes, s.id] : scopes.filter((x) => x !== s.id))}
                  />
                  <span>
                    <span className="font-medium">{s.label}</span>
                    <span className="block text-xs text-muted-foreground">{s.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div>
              <Label htmlFor="key-expiry" className="mb-1.5">Expires</Label>
              <select id="key-expiry" className={selectClass} value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                {KEY_EXPIRY_CHOICES.map((d) => (
                  <option key={d} value={d}>{d === 365 ? "After 1 year" : `After ${d} days`}</option>
                ))}
                <option value="never">Never (less safe)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="key-ips" className="mb-1.5">Only allow these server addresses (recommended)</Label>
              <Textarea
                id="key-ips"
                rows={2}
                placeholder="203.0.113.10 (one per line; leave empty to allow any address)"
                value={ips}
                onChange={(e) => setIps(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The IP address your website&apos;s server calls from. A key limited like this is useless to anyone who copies it.
              </p>
            </div>

            {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || scopes.length === 0}>{saving ? "Creating…" : "Create key"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={created !== null} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Copy your key now</DialogTitle>
            <DialogDescription className="flex items-start gap-2">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
              This is the only time it is shown. AIRA keeps no copy, so if you lose it, revoke it and make a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2">
            <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg border bg-muted/40 px-3 py-2 text-xs" data-testid="new-api-key">{created}</pre>
            <Button type="button" variant="outline" size="sm" onClick={copyKey}>
              {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setCreated(null)}>I have saved it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Revoke this key?"
        description={revoking ? `"${revoking.name}" stops working immediately. Anything using it will get errors until you give it a new key.` : undefined}
        confirmLabel="Revoke"
        onConfirm={() => {
          const target = revoking;
          setRevoking(null);
          if (target) void revoke(target);
        }}
      />
    </div>
  );
}
