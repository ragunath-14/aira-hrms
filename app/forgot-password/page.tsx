"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MailCheckIcon } from "lucide-react";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/email-status")
      .then((r) => r.json())
      .then((d) => setEnabled(Boolean(d.enabled)))
      .catch(() => setEnabled(true));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");

    try {
      const { error } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      });

      // The answer is the same whether or not the address has an account.
      if (error && error.status === 429) {
        setError("Too many requests. Please wait a while and try again.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md space-y-5 p-8">
        {done ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <MailCheckIcon className="size-6" />
            </div>
            <h1 className="text-xl font-semibold">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              If an account exists for {email}, we have sent a link to choose a new
              password. It is valid for one hour.
            </p>
            <Button variant="outline" render={<Link href="/login" />}>
              Back to sign in
            </Button>
          </div>
        ) : enabled === false ? (
          <div className="space-y-4 text-center">
            <h1 className="text-xl font-semibold">Password reset by email is not set up</h1>
            <p className="text-sm text-muted-foreground">
              This site cannot send email yet. Ask your company administrator to set a new
              password for you.
            </p>
            <Button variant="outline" render={<Link href="/login" />}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold">Forgot your password?</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your work email and we will send you a link to reset it.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fp-email">Email</Label>
              <Input
                id="fp-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={sending || !email.trim()}>
              {sending ? "Sending…" : "Send reset link"}
            </Button>

            <p className="text-center text-sm">
              <Link href="/login" className="text-primary hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </Card>
    </main>
  );
}
