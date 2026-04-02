"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { TraceFilters } from "@/components/dashboard/TraceFilters";
import { Pagination } from "@/components/dashboard/Pagination";

interface Trace {
  id: string;
  name: string;
  status: string;
  tokens: number;
  cost: number;
  latency: number;
  model: string;
  createdAt: string;
  span_count: number;
}

interface FilterOptions {
  agents: { agent_id: string; agent_name: string }[];
  models: string[];
}

// Column definitions for sortable headers
const SORT_COLUMNS: Record<string, string> = {
  name: "name",
  status: "status_code",
  tokens: "prompt_tokens",
  cost: "accumulated_cost_usd",
  latency: "latency_ms",
  time: "start_time",
};

export default function TracesPage() {
  return (
    <Suspense fallback={<p className="text-slate-gray">Loading...</p>}>
      <TracesContent />
    </Suspense>
  );
}

function TracesContent() {
  const { lang } = useParams<{ lang: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read state from URL
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const agentId = searchParams.get("agent_id") || "";
  const model = searchParams.get("model") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const sort = searchParams.get("sort") || "";
  const order = searchParams.get("order") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = parseInt(searchParams.get("perPage") || "50", 10);

  const [traces, setTraces] = useState<Trace[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ agents: [], models: [] });

  // Update URL params
  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    // Reset to page 1 when filters change
    if (!("page" in updates)) params.delete("page");
    router.push(`?${params.toString()}`);
  }, [searchParams, router]);

  // Fetch filter options once
  useEffect(() => {
    fetchAPI<FilterOptions>("/api/traces/filters")
      .then(setFilterOptions)
      .catch(() => {});
  }, []);

  // Fetch traces when params change
  useEffect(() => {
    setLoading(true);
    const offset = (page - 1) * perPage;
    const apiParams = new URLSearchParams();
    apiParams.set("limit", String(perPage));
    apiParams.set("offset", String(offset));
    if (search) apiParams.set("search", search);
    if (status) apiParams.set("status", status);
    if (agentId) apiParams.set("agent_id", agentId);
    if (model) apiParams.set("model", model);
    if (from) apiParams.set("from", from);
    if (to) apiParams.set("to", to);
    if (sort) apiParams.set("sort", sort);
    if (order) apiParams.set("order", order);

    fetchAPI<{ traces: Trace[]; total: number } | Trace[]>(`/api/traces?${apiParams}`)
      .then((d) => {
        if (Array.isArray(d)) {
          setTraces(d);
          setTotal(d.length);
        } else {
          setTraces(d.traces || []);
          setTotal(d.total || 0);
        }
      })
      .catch(() => { setTraces([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [search, status, agentId, model, from, to, sort, order, page, perPage]);

  // Sort handler
  function handleSort(column: string) {
    const field = SORT_COLUMNS[column];
    if (!field) return;
    if (sort === field && order === "asc") {
      updateParams({ sort: field, order: "desc" });
    } else if (sort === field && order === "desc") {
      updateParams({ sort: "", order: "" });
    } else {
      updateParams({ sort: field, order: "asc" });
    }
  }

  function sortIndicator(column: string): string {
    const field = SORT_COLUMNS[column];
    if (sort !== field) return "";
    return order === "asc" ? " ▲" : " ▼";
  }

  const thClass = "pb-3 pr-4 cursor-pointer hover:text-white transition-colors select-none";

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-4">Traces</h1>

      <TraceFilters
        search={search}
        status={status}
        agentId={agentId}
        model={model}
        from={from}
        to={to}
        agents={filterOptions.agents}
        models={filterOptions.models}
        onChange={updateParams}
      />

      {loading ? (
        <p className="text-slate-gray">Loading...</p>
      ) : traces.length === 0 ? (
        <p className="text-slate-gray">No traces found. {search || status || agentId || model ? "Try adjusting your filters." : "Send your first trace to see it here."}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-light text-left text-slate-gray">
                  <th className={thClass} onClick={() => handleSort("name")}>Name{sortIndicator("name")}</th>
                  <th className={thClass} onClick={() => handleSort("status")}>Status{sortIndicator("status")}</th>
                  <th className={thClass} onClick={() => handleSort("tokens")}>Tokens{sortIndicator("tokens")}</th>
                  <th className={thClass} onClick={() => handleSort("cost")}>Cost{sortIndicator("cost")}</th>
                  <th className={thClass} onClick={() => handleSort("latency")}>Latency{sortIndicator("latency")}</th>
                  <th className="pb-3 pr-4">Spans</th>
                  <th className={thClass} onClick={() => handleSort("time")}>Time{sortIndicator("time")}</th>
                </tr>
              </thead>
              <tbody>
                {traces.map((t) => (
                  <tr key={t.id} className="border-b border-navy-light/50 hover:bg-navy-mid/30">
                    <td className="py-3 pr-4">
                      <Link href={`/${lang}/dashboard/traces/${t.id}`} className="text-electric-blue hover:underline">
                        {t.name || t.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded ${t.status?.toLowerCase() === "ok" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
                        {t.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-gray">{t.tokens?.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-slate-gray">${t.cost?.toFixed(4)}</td>
                    <td className="py-3 pr-4 text-slate-gray">{t.latency?.toFixed(0)}ms</td>
                    <td className="py-3 pr-4 text-slate-gray">{t.span_count}</td>
                    <td className="py-3 text-slate-gray text-xs">{new Date(t.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            perPage={perPage}
            total={total}
            onPageChange={(p) => updateParams({ page: String(p) })}
            onPerPageChange={(pp) => updateParams({ perPage: String(pp), page: "" })}
          />
        </>
      )}
    </div>
  );
}
