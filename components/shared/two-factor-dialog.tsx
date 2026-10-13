"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ClipboardIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Step = "start" | "scan" | "codes" | "manage";

// Turn two-factor sign-in on or off for your own account. Setup: confirm your
// password, scan the QR code with an authenticator app, enter the 6-digit code,
// then save the recovery codes.
export function TwoFactorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: session } = authClient.useSession();
  const sessionEnabled = Boolean(
    (session?.user as { twoFactorEnabled?: boolean | null } | undefined)?.twoFactorEnabled,
  );

  const [step, setStep] = useState<Step>("start");
  const [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // `pristine` is true until the person does something in the dialog. While it
  // is, the dialog follows the saved state of the account (which may still be
  // loading when it opens). After any action it follows the actions instead, so
  // a refreshed session can never yank the person back to another screen.
  const pristine = useRef(true);

  useEffect(() => {
    if (!open) return;
    pristine.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPassword("");
    setCode("");
    setError("");
    setBackupCodes([]);
  }, [open]);

  useEffect(() => {
    if (!open || !pristine.current) return;
    setEnabled(sessionEnabled);
    setStep(sessionEnabled ? "manage" : "start");
  }, [open, sessionEnabled]);

  function fail(message?: string) {
    setError(message || "Something went wrong. Please try again.");
  }

  async function begin(e: React.FormEvent) {
    e.preventDefault();
    pristine.current = false;
    setBusy(true);
    setError("");

    try {
      const { data, error } = await authClient.twoFactor.enable({ password, method: "totp" });

      if (error || !data || data.method !== "totp") return fail(error?.message);

      setQr(await QRCode.toDataURL(data.totpURI, { width: 200, margin: 1 }));
      setSecret(new URL(data.totpURI).searchParams.get("secret") ?? "");
      setBackupCodes(data.backupCodes ?? []);
      setPassword("");
      setStep("scan");
    } catch {
      fail();
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault();
    pristine.current = false;
    setBusy(true);
    setError("");

    try {
      const { error } = await authClient.twoFactor.verifyTotp({ code: code.trim() });

      if (error) return fail(error.message || "That code is not right. Check the time on your phone and try again.");

      setEnabled(true);
      setCode("");
      setStep("codes");
      toast.success("Two-factor sign-in is on");
    } catch {
      fail();
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(e: React.FormEvent) {
    e.preventDefault();
    pristine.current = false;
    setBusy(true);
    setError("");

    try {
      const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });

      if (error || !data) return fail(error?.message);

      setBackupCodes(data.backupCodes);
      setPassword("");
      setStep("codes");
    } catch {
      fail();
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    pristine.current = false;
    setBusy(true);
    setError("");

    try {
      const { error } = await authClient.twoFactor.disable({ password });

      if (error) return fail(error.message);

      setEnabled(false);
      setPassword("");
      setStep("start");
      toast.success("Two-factor sign-in is off");
    } catch {
      fail();
    } finally {
      setBusy(false);
    }
  }

  function copyCodes() {
    navigator.clipboard
      ?.writeText(backupCodes.join("\n"))
      .then(() => toast.success("Recovery codes copied"))
      .catch(() => toast.error("Could not copy. Select the codes and copy them by hand."));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheckIcon className="size-5 text-primary" /> Two-factor sign-in
          </DialogTitle>
          <DialogDescription>
            {enabled
              ? "Signing in needs your password and a code from your authenticator app."
              : "Add a second step at sign-in with an authenticator app, so a stolen password is not enough."}
          </DialogDescription>
        </DialogHeader>

        {step === "start" && (
          <form onSubmit={begin} className="space-y-4">
            <div>
              <Label htmlFor="tf-pass" className="mb-1.5">Confirm your password</Label>
              <Input id="tf-pass" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={busy || !password}>{busy ? "Preparing…" : "Set up"}</Button>
            </DialogFooter>
          </form>
        )}

        {step === "scan" && (
          <form onSubmit={confirmCode} className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy).</li>
              <li>Scan this QR code, or type the key below.</li>
              <li>Enter the 6-digit code it shows.</li>
            </ol>

            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr && <img src={qr} alt="QR code for your authenticator app" width={200} height={200} className="rounded-lg border" />}
              {secret && (
                <p className="select-all break-all rounded-md bg-muted px-3 py-1.5 text-center font-mono text-xs">{secret}</p>
              )}
            </div>

            <div>
              <Label htmlFor="tf-code" className="mb-1.5">6-digit code</Label>
              <Input id="tf-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={busy || code.trim().length < 6}>{busy ? "Checking…" : "Turn on"}</Button>
            </DialogFooter>
          </form>
        )}

        {step === "codes" && (
          <div className="space-y-4">
            <p className="text-sm">
              Save these recovery codes somewhere safe. Each one works once if you lose your phone. <strong>They will not be shown again.</strong>
            </p>
            <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
              {backupCodes.map((c) => (
                <li key={c} className="select-all">{c}</li>
              ))}
            </ul>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={copyCodes}>
                <ClipboardIcon /> Copy codes
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>I have saved them</Button>
            </DialogFooter>
          </div>
        )}

        {step === "manage" && (
          <form onSubmit={regenerate} className="space-y-4">
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Two-factor sign-in is on for your account.
            </p>
            <div>
              <Label htmlFor="tf-pass2" className="mb-1.5">Your password</Label>
              <Input id="tf-pass2" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Needed to make a change.</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy || !password} onClick={turnOff} className="text-destructive">
                Turn off
              </Button>
              <Button type="submit" disabled={busy || !password}>New recovery codes</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
