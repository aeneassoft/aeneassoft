"use client";

import { useState, useEffect } from "react";
import { getAuthToken } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SupportModal({ open, onClose }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      // Pre-fill email from cookie/JWT if available
      const match = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);
      if (match) {
        try {
          const payload = JSON.parse(atob(decodeURIComponent(match[1]).split(".")[1]));
          if (payload.email) setEmail(payload.email);
        } catch {}
      }
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/support`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setSent(false);
    setError("");
    setSubject("");
    setMessage("");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div className="glass rounded-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <div className="text-center py-4">
            <p className="text-green-400 text-lg font-semibold mb-2">Vielen Dank!</p>
            <p className="text-slate-gray text-sm">Wir melden uns innerhalb von 24 Stunden.</p>
            <button onClick={handleClose}
              className="mt-6 rounded-lg bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-electric-blue/90 transition-colors">
              Schließen
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-white mb-4">Support kontaktieren</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input type="text" required minLength={2} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-sm text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue" />
              <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-sm text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue" />
              <input type="text" required minLength={5} placeholder="Betreff" value={subject} onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-sm text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue" />
              <textarea required minLength={20} rows={4} placeholder="Ihre Nachricht (min. 20 Zeichen)" value={message} onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-sm text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue resize-none" />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={handleClose}
                  className="flex-1 rounded-lg border border-navy-light px-4 py-2 text-sm font-semibold text-slate-gray hover:text-white transition-colors">
                  Abbrechen
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 rounded-lg bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-electric-blue/90 transition-colors disabled:opacity-50">
                  {loading ? "Senden..." : "Nachricht senden"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
