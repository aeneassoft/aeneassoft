"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SupportModal } from "./SupportModal";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function TracesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function AlertsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 7.76a6 6 0 0 0 0 8.49" />
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function ConfigIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function DashboardSidebar({ lang, onCloseMobile }: { lang: string; onCloseMobile?: () => void }) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  const navItems: NavItem[] = [
    { label: "Overview", href: `/${lang}/dashboard`, icon: <HomeIcon /> },
    { label: "Traces", href: `/${lang}/dashboard/traces`, icon: <TracesIcon /> },
    { label: "Reports", href: `/${lang}/dashboard/reports`, icon: <ReportsIcon /> },
    { label: "Defense", href: `/${lang}/dashboard/alerts`, icon: <AlertsIcon /> },
    { label: "Config", href: `/${lang}/dashboard/config`, icon: <ConfigIcon /> },
    { label: "Settings", href: `/${lang}/dashboard/settings`, icon: <SettingsIcon /> },
    { label: "Billing", href: `/${lang}/dashboard/billing`, icon: <BillingIcon /> },
  ];

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore network errors
    }
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = `/${lang}/login`;
  }

  return (
    <aside
      style={{ width: 240, minHeight: "100vh" }}
      className="flex flex-col bg-[var(--deep-navy)] border-r border-[var(--navy-light)] py-6"
    >
      {/* Logo + Mobile close */}
      <div className="px-6 mb-8 flex items-center justify-between">
        <Link href={`/${lang}`} className="flex items-center gap-2">
          <span className="text-[var(--electric-blue)] font-bold text-xl tracking-tight">
            Aeneas<span className="text-[var(--gold)]">Soft</span>
          </span>
        </Link>
        {onCloseMobile && (
          <button onClick={onCloseMobile} className="md:hidden text-[var(--slate-gray)] hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === `/${lang}/dashboard`
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--electric-blue)]/10 text-[var(--electric-blue)]"
                  : "text-[var(--slate-gray)] hover:text-white hover:bg-white/5"
              }`}
            >
              <span className={isActive ? "text-[var(--electric-blue)]" : ""}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Support + Logout */}
      <div className="px-3 mt-4 space-y-1">
        <button
          onClick={() => setSupportOpen(true)}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--slate-gray)] hover:text-white hover:bg-white/5 transition-colors"
        >
          <SupportIcon />
          Support
        </button>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--slate-gray)] hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogoutIcon />
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </aside>
  );
}
