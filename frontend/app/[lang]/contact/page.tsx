"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function ContactPage() {
  const { lang } = useParams<{ lang: string }>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      setSent(true);
    } catch {} finally {
      setLoading(false);
    }
  }

  return (
    <section className="py-20">
      <div className="mx-auto max-w-lg px-4">
        <h1 className="text-3xl font-bold text-white text-center mb-2">
          {lang === "de" ? "Kontakt" : "Contact Us"}
        </h1>
        <p className="text-slate-gray text-center mb-8">
          {lang === "de" ? "Wir freuen uns von dir zu hören." : "We'd love to hear from you."}
        </p>

        {sent ? (
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-green-400">
              {lang === "de" ? "Nachricht gesendet! Wir melden uns in 24h." : "Message sent! We'll get back to you within 24 hours."}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" required placeholder={lang === "de" ? "Name" : "Name"} value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue" />
            <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue" />
            <textarea required rows={5} placeholder={lang === "de" ? "Nachricht" : "Message"} value={message} onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg bg-navy-mid border border-navy-light px-3 py-2 text-white placeholder:text-slate-gray/50 focus:outline-none focus:border-electric-blue resize-none" />
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-electric-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-electric-blue/90 transition-colors disabled:opacity-50">
              {loading ? "..." : lang === "de" ? "Nachricht senden" : "Send Message"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
