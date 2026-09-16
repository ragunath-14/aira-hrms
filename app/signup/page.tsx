"use client";

import { useState } from "react";

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
    <main className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={handleSignup}
        className="w-full max-w-md space-y-4 rounded-lg border p-6"
      >
        <h1 className="text-2xl font-bold">Create Account</h1>

        <input
          className="w-full rounded border p-2"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

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
          Sign Up
        </button>

        {message && <p>{message}</p>}
      </form>
    </main>
  );
}