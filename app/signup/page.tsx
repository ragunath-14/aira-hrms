"use client";

import { useState } from "react";
import { CheckIcon, LockIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TRUST_POINTS = [
  { icon: UsersIcon, text: "Role-based access controls" },
  { icon: LockIcon, text: "Tenant-isolated workspaces" },
  { icon: ShieldCheckIcon, text: "Every change logged to an audit trail" },
];

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    setMessage("Creating account...");

    const response = await fetch("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data?.message ?? "Signup failed");
      return;
    }

    setMessage("Account created. Setting up your company...");

    try {
      const syncResponse = await fetch("/api/users/sync", {
        method: "POST",
      });

      if (!syncResponse.ok) {
        setMessage("Account created, but company setup failed. Please try logging in.");
        return;
      }

      const tenantResponse = await fetch("/api/tenant", {
        method: "GET",
      });

      if (!tenantResponse.ok) {
        const tenantData = await tenantResponse.json();
        setMessage(
          tenantData?.error ??
            "Account created, but tenant context was not found. Please try logging in.",
        );
        return;
      }

      const tenantContext = await tenantResponse.json();
      const role = tenantContext?.membership?.role;

      if (role === "employee" || role === "member") {
        window.location.href = "/employee";
        return;
      }

      window.location.href = "/";
    } catch (error) {
      console.error("Post-signup setup error:", error);
      setMessage("Account created, but company setup failed. Please try logging in.");
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
            Set up a secure, tenant-isolated workspace for your company in
            minutes.
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
              Create your account
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Set up your company workspace on AIRA HRMS.
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="signup-name">Name</Label>
              <Input
                id="signup-name"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full">
              Sign Up
            </Button>
          </form>

          {message && (
            <p className="text-center text-sm text-muted-foreground">
              {message}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
