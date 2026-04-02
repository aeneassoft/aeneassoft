"use client";

interface PaginationProps {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

export function Pagination({ page, perPage, total, onPageChange, onPerPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const from = Math.min((page - 1) * perPage + 1, total);
  const to = Math.min(page * perPage, total);

  // Build page numbers: 1 ... (p-1) p (p+1) ... last
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  const btnBase = "px-2.5 py-1 text-xs rounded transition-colors";
  const btnActive = "bg-electric-blue text-white";
  const btnInactive = "bg-navy-mid text-slate-gray hover:text-white hover:bg-navy-light";
  const btnDisabled = "bg-navy-mid text-slate-gray/40 cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
      <span className="text-xs text-slate-gray">
        {total > 0 ? `Showing ${from}-${to} of ${total.toLocaleString()}` : "No results"}
      </span>

      <div className="flex items-center gap-2">
        {/* Per-page selector */}
        <select
          value={perPage}
          onChange={(e) => onPerPageChange(Number(e.target.value))}
          className="rounded-lg bg-navy-mid border border-navy-light px-2 py-1 text-xs text-white focus:outline-none appearance-none cursor-pointer"
        >
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>

        {/* Prev */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={`${btnBase} ${page <= 1 ? btnDisabled : btnInactive}`}
        >
          &larr;
        </button>

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="text-xs text-slate-gray px-1">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`${btnBase} ${p === page ? btnActive : btnInactive}`}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={`${btnBase} ${page >= totalPages ? btnDisabled : btnInactive}`}
        >
          &rarr;
        </button>
      </div>
    </div>
  );
}
