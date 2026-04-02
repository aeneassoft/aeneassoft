"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { lang } = useParams<{ lang: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      document.cookie = `token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
      const safeRedirect = from && from.startsWith('/') && !from.startsWith('//') ? from : `/${lang}/dashboard`;
      router.push(safeRedirect);
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
          {lang === "de" ? "Willkommen zurück" : "Welcome Back"}
        </h1>
        <p className="text-sm text-slate-gray text-center mb-8">
          {lang === "de"
            ? "Melde dich bei deinem Dashboard an."
            : "Sign in to your AeneasSoft dashboard."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-gray mb-1">
              {lang === "de" ? "E-Mail" : "Email"}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-gray mb-1">
              {lang === "de" ? "Passwort" : "Password"}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-electric-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-electric-blue/90 transition-colors disabled:opacity-50"
          >
            {loading
              ? "..."
              : lang === "de"
                ? "Anmelden"
                : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-gray space-y-2">
          <Link
            href={`/${lang}/forgot-password`}
            className="block hover:text-white transition-colors"
          >
            {lang === "de" ? "Passwort vergessen?" : "Forgot password?"}
          </Link>
          <p>
            {lang === "de" ? "Noch kein Konto?" : "No account yet?"}{" "}
            <Link
              href={`/${lang}/register`}
              className="text-electric-blue hover:underline"
            >
              {lang === "de" ? "Registrieren" : "Create one"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
