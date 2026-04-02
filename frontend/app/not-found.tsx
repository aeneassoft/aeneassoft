import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-deep-navy px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-electric-blue mb-4">404</h1>
        <p className="text-xl text-white mb-2">Page not found</p>
        <p className="text-slate-gray mb-8">The page you are looking for does not exist. Perhaps it's an uncontrolled AI agent?</p>
        <Link
          href="/en"
          className="inline-flex items-center rounded-lg bg-electric-blue px-6 py-3 text-sm font-semibold text-white hover:bg-electric-blue/90 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
