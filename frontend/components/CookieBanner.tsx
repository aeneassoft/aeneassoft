"use client";

import { useState, useEffect } from "react";

export function CookieBanner({ lang }: { lang: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem("cookie_consent", "accepted");
    setVisible(false);
  }

  function reject() {
    localStorage.setItem("cookie_consent", "rejected");
    setVisible(false);
  }

  if (!visible) return null;

  const isDE = lang === "de";

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4">
      <div className="mx-auto max-w-2xl glass rounded-xl border border-navy-light p-4 sm:p-5 shadow-2xl">
        <p className="text-sm text-slate-gray mb-4">
          {isDE
            ? "Wir verwenden essenzielle Cookies für die Authentifizierung, um Ihren sicheren Zugang zu gewährleisten. Keine Tracking-Cookies ohne Ihre Einwilligung."
            : "We use essential cookies for authentication to ensure your secure access. No tracking cookies without your consent."}
        </p>
        <div className="flex gap-3">
          <button
            onClick={accept}
            className="flex-1 rounded-lg bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-electric-blue/90 transition-colors"
          >
            {isDE ? "Alle akzeptieren" : "Accept All"}
          </button>
          <button
            onClick={reject}
            className="flex-1 rounded-lg border border-navy-light px-4 py-2 text-sm font-semibold text-slate-gray hover:text-white hover:border-slate-gray transition-colors"
          >
            {isDE ? "Alle ablehnen" : "Reject All"}
          </button>
        </div>
      </div>
    </div>
  );
}
