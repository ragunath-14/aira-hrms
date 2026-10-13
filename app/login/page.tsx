"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, LockIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TRUST_POINTS = [
  { icon: UsersIcon, text: "Role-based access controls" },
  { icon: LockIcon, text: "Tenant-isolated workspaces" },
  { icon: ShieldCheckIcon, text: "Every change logged to an audit trail" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  // After the password (and the authenticator code, if required) are accepted:
  // set up the HRMS user and go to the right home page.
  async function finishLogin() {
    try {
      // 2. Sync HRMS user
      const syncResponse = await fetch("/api/users/sync", {
        method: "POST",
      });

      const syncData = await syncResponse.json().catch(() => null);

      if (!syncResponse.ok) {
        setMessage(syncData?.error ?? "Login successful, but user sync failed");
        return;
      }

      // The platform owner has no company; go straight to Access Requests.
      if (syncData?.user?.isSuperAdmin) {
        window.location.href = "/admin";
        return;
      }

      // 3. Get authenticated tenant + membership
      const tenantResponse = await fetch("/api/tenant", {
        method: "GET",
      });

      if (!tenantResponse.ok) {
        const tenantData = await tenantResponse.json();

        setMessage(
          tenantData?.error ??
            "Login successful, but tenant context was not found",
        );
        return;
      }

      const tenantContext = await tenantResponse.json();

      // Platform owner goes to the access-requests page; companies still
      // waiting for approval go to the waiting page.
      if (tenantContext?.user?.isSuperAdmin) {
        window.location.href = "/admin";
        return;
      }

      if (tenantContext?.tenant?.accessStatus !== "approved") {
        window.location.href = "/pending-approval";
        return;
      }

      // 4. Read role from authenticated membership
      const role = tenantContext?.membership?.role;

      if (!role) {
        setMessage("Your account does not have a valid role");
        return;
      }

      // 5. Redirect based on role
      if (role === "employee" || role === "member") {
        window.location.href = "/employee";
        return;
      }

      if (
        role === "owner" ||
        role === "admin" ||
        role === "hr" ||
        role === "manager"
      ) {
        window.location.href = "/";
        return;
      }

      setMessage(`Unknown role: ${role}`);
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Something went wrong during login");
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setMessage("Checking code...");

    try {
      const response = await fetch(
        useBackupCode ? "/api/auth/two-factor/verify-backup-code" : "/api/auth/two-factor/verify-totp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.trim() }),
        },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(data?.message ?? "That code is not valid");
        return;
      }

      await finishLogin();
    } catch {
      setMessage("Something went wrong. Please try again.");
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setMessage("Signing in...");

    try {
      // 1. Sign in
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data?.message ?? "Login failed");
        return;
      }

      if (data?.twoFactorRedirect) {
        // Password accepted; this person also needs their authenticator code.
        setTwoFactorStep(true);
        setMessage("");
        return;
      }

      await finishLogin();
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Something went wrong during login");
    }
  }

  return (
    <main className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_20%_0%,var(--color-sidebar-primary),transparent)] opacity-20"
        />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
            HR
          </div>
          <p className="text-base font-bold">AIRA HRMS</p>
        </div>

        <div className="relative max-w-sm space-y-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
            The operating system for your people
          </p>
          <h2 className="text-3xl font-bold leading-tight text-sidebar-foreground">
            Clarity for every person, process and payroll.
          </h2>
          <p className="text-sm text-sidebar-foreground/60">
            A secure, tenant-isolated workspace for HR teams and employees
            to move work forward with confidence.
          </p>

          <ul className="space-y-2.5 pt-2">
            {TRUST_POINTS.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-2.5 text-sm text-sidebar-foreground/75"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sidebar-accent">
                  <CheckIcon className="size-3 text-sidebar-primary" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-foreground/35">
          © 2026 AIRA HRMS · Security · Privacy · Status
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-2 text-center lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
              HR
            </div>
            <p className="text-lg font-bold text-foreground">AIRA HRMS</p>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your AIRA HRMS account.
            </p>
          </div>

          {twoFactorStep ? (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-code">
                  {useBackupCode ? "Recovery code" : "Authenticator code"}
                </Label>
                <Input
                  id="login-code"
                  inputMode={useBackupCode ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder={useBackupCode ? "xxxxx-xxxxx" : "6-digit code"}
                  maxLength={useBackupCode ? 24 : 6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {useBackupCode
                    ? "Enter one of the recovery codes you saved. Each works once."
                    : "Open your authenticator app and enter the current 6-digit code."}
                </p>
              </div>

              <Button type="submit" className="w-full">
                Verify and sign in
              </Button>

              <p className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => {
                    setUseBackupCode(!useBackupCode);
                    setCode("");
                    setMessage("");
                  }}
                >
                  {useBackupCode ? "Use authenticator code" : "Use a recovery code"}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:underline"
                  onClick={() => {
                    setTwoFactorStep(false);
                    setUseBackupCode(false);
                    setCode("");
                    setPassword("");
                    setMessage("");
                  }}
                >
                  Back
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full">
              Login
            </Button>

            <p className="text-center text-sm">
              <Link href="/forgot-password" className="text-primary hover:underline">
                Forgot password?
              </Link>
            </p>
          </form>
          )}

          {message && (
            <p className="text-center text-sm text-muted-foreground">
              {message}
            </p>
          )}

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70">
            <LockIcon className="size-3" />
            Protected by tenant-isolated authentication
          </p>
        </div>
      </div>
    </main>
  );
}
