
"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

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

      // 2. Sync HRMS user
      const syncResponse = await fetch("/api/users/sync", {
        method: "POST",
      });

      if (!syncResponse.ok) {
        setMessage("Login successful, but user sync failed");
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

  async function handleLogout() {
    setMessage("Signing out...");

    try {
      const { error } = await authClient.signOut();

      if (error) {
        setMessage(error.message ?? "Logout failed");
        return;
      }

      setMessage("Logout successful!");
    } catch (error) {
      console.error("Logout error:", error);
      setMessage("Logout failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <form
          onSubmit={handleLogin}
          className="space-y-4 rounded-lg border bg-white p-6 shadow-sm"
        >
          <h1 className="text-2xl font-bold">Login</h1>

          <input
            className="w-full rounded border p-2"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            className="w-full rounded border p-2"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full rounded bg-black p-2 text-white"
          >
            Login
          </button>
        </form>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded border p-2"
        >
          Logout
        </button>

        {message && (
          <p className="text-center text-sm text-gray-600">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}

