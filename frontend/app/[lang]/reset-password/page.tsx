"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}

function ResetForm() {
  const { lang } = useParams<{ lang: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
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
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Reset failed");
      }
      setSuccess(true);
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
          {lang === "de" ? "Neues Passwort setzen" : "Set New Password"}
        </h1>

        {success ? (
          <div className="glass rounded-xl p-6 text-center mt-6">
            <p className="text-green-400 text-sm mb-4">
              {lang === "de" ? "Passwort aktualisiert!" : "Password updated!"}
            </p>
            <Link href={`/${lang}/login`} className="text-electric-blue hover:underline text-sm">
              {lang === "de" ? "Zum Login" : "Sign in"}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <input type="password" required minLength={8} placeholder={lang === "de" ? "Neues Passwort" : "New Password"}
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue" />
            <input type="password" required placeholder={lang === "de" ? "Bestätigen" : "Confirm"}
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue" />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-electric-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-electric-blue/90 transition-colors disabled:opacity-50">
              {loading ? "..." : lang === "de" ? "Passwort zurücksetzen" : "Reset Password"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm">
          <Link href={`/${lang}/login`} className="text-slate-gray hover:text-white transition-colors">
            {lang === "de" ? "Zurück zum Login" : "Back to login"}
          </Link>
        </p>
      </div>
    </div>
  );
}
