"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function ForgotPasswordPage() {
  const { lang } = useParams<{ lang: string }>();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {} finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white text-center mb-2">
          {lang === "de" ? "Passwort zurücksetzen" : "Reset Your Password"}
        </h1>
        <p className="text-sm text-slate-gray text-center mb-8">
          {lang === "de" ? "Wir senden dir einen Reset-Link." : "We'll send you a reset link."}
        </p>

        {sent ? (
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-green-400 text-sm">
              {lang === "de"
                ? "Falls ein Konto existiert, erhältst du einen Reset-Link."
                : "If an account exists, you'll receive a reset link shortly."}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
              className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue" />
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-electric-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-electric-blue/90 transition-colors disabled:opacity-50">
              {loading ? "..." : lang === "de" ? "Reset-Link senden" : "Send Reset Link"}
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
