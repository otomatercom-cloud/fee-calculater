"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { login, password });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <main className="login-wrap">
      <div className="login-art">
        <div className="brand-mark">₹</div>
        <h1>Fee Calculator</h1>
        <p>Course fee, GST, scholarship and one-time payment — worked out in one tap.</p>
        <ul>
          <li>Admission, material and course fee</li>
          <li>GST and scholarship / discount</li>
          <li>One-time payment offer</li>
        </ul>
      </div>
      <form className="login-card" onSubmit={submit}>
        <h2>Sign in</h2>
        <p className="muted">Use your Odoo login.</p>
        <label>Login
          <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoFocus placeholder="user@company.com" />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
        </label>
        {error && <div className="alert">{error}</div>}
        <button className="btn primary block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
