"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function RegisterPage() {
  const { lang } = useParams<{ lang: string }>();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(lang === "de" ? "Passwörter stimmen nicht überein" : "Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(inviteCode ? { invite_code: inviteCode } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      document.cookie = `token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
      router.push(`/${lang}/dashboard`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white text-center mb-2">
          {lang === "de" ? "Konto erstellen" : "Create Your Account"}
        </h1>
        <p className="text-sm text-slate-gray text-center mb-8">
          {lang === "de"
            ? "Starte das Tracing deiner KI-Agenten in unter 2 Minuten."
            : "Start tracing your AI agents in under 2 minutes."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-gray mb-1">
              {lang === "de" ? "E-Mail" : "Email"}
            </label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue" />
          </div>
          <div>
            <label className="block text-sm text-slate-gray mb-1">
              {lang === "de" ? "Passwort" : "Password"}
            </label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue" />
          </div>
          <div>
            <label className="block text-sm text-slate-gray mb-1">
              {lang === "de" ? "Passwort bestätigen" : "Confirm Password"}
            </label>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue" />
          </div>

          <div>
            <label className="block text-sm text-slate-gray mb-1">
              Invite Code <span className="text-slate-gray/50">({lang === "de" ? "optional" : "optional"})</span>
            </label>
            <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
              placeholder={lang === "de" ? "Falls du einen hast" : "If you have one"}
              className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue" />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-electric-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-electric-blue/90 transition-colors disabled:opacity-50">
            {loading ? "..." : lang === "de" ? "Konto erstellen" : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-gray">
          {lang === "de" ? "Bereits ein Konto?" : "Already have an account?"}{" "}
          <Link href={`/${lang}/login`} className="text-electric-blue hover:underline">
            {lang === "de" ? "Anmelden" : "Sign in"}
          </Link>
        </p>
      </div>
    </div>
  );
}
