import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '[PRODUCTNAME] — Agent Observability Dashboard',
  description: 'Observe, debug, and audit multi-agent AI systems',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-white">[PRODUCTNAME]</span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
              MVP
            </span>
          </div>
          <div className="text-sm text-gray-500">Agent Observability Dashboard</div>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
