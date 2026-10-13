"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2Icon } from "lucide-react";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const invalidLink = !token || params.get("error") === "INVALID_TOKEN";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await authClient.resetPassword({ newPassword: password, token: token! });

      if (error) {
        setError(
          error.status === 400
            ? "This link is invalid or has expired. Request a new one."
            : error.message || "Could not reset the password.",
        );
      } else {
        setDone(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2Icon className="size-6" />
        </div>
        <h1 className="text-xl font-semibold">Password changed</h1>
        <p className="text-sm text-muted-foreground">
          You were signed out everywhere. Sign in with your new password.
        </p>
        <Button render={<Link href="/login" />}>Go to sign in</Button>
      </div>
    );
  }

  if (invalidLink) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold">This link is not valid</h1>
        <p className="text-sm text-muted-foreground">
          The reset link is incorrect or has expired. Request a new one.
        </p>
        <Button render={<Link href="/forgot-password" />}>Request a new link</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">At least 12 characters.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rp-new">New password</Label>
        <Input
          id="rp-new"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rp-confirm">Confirm password</Label>
        <Input
          id="rp-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={saving || password.length < 12}>
        {saving ? "Saving…" : "Reset password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md p-8">
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </Card>
    </main>
  );
}
