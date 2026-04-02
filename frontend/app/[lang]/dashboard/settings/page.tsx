"use client";

import { useEffect, useState } from "react";
import { fetchAPI } from "@/lib/api";

interface ApiKey {
  id: string;
  prefix: string;
  created_at: string;
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAPI<ApiKey[]>("/api/keys")
      .then(setKeys)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function createKey() {
    try {
      const data = await fetchAPI<{ id: string; key: string; prefix: string }>("/api/keys", {
        method: "POST",
      });
      setNewKey(data.key);
      setKeys((prev) => [...prev, { id: data.id, prefix: data.prefix, created_at: new Date().toISOString() }]);
    } catch {}
  }

  async function deleteKey(id: string) {
    try {
      await fetchAPI(`/api/keys/${id}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">API Keys</h1>

      {newKey && (
        <div className="glass rounded-xl p-4 mb-6 border border-gold/30">
          <p className="text-sm text-gold font-semibold mb-2">New API Key (shown only once):</p>
          <div className="flex items-center gap-2">
            <code className="text-sm text-white bg-navy-mid px-3 py-1.5 rounded flex-1 overflow-x-auto">
              {newKey}
            </code>
            <button onClick={() => copyToClipboard(newKey)}
              className="text-xs px-3 py-1.5 bg-electric-blue rounded text-white hover:bg-electric-blue/90">
              Copy
            </button>
          </div>
        </div>
      )}

      <button onClick={createKey}
        className="rounded-lg bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-electric-blue/90 transition-colors mb-6">
        Create New Key
      </button>

      {loading ? (
        <p className="text-slate-gray">Loading...</p>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <div key={k.id} className="glass rounded-xl p-4 flex items-center justify-between">
              <div>
                <code className="text-sm text-white">{k.prefix}...</code>
                <p className="text-xs text-slate-gray mt-1">
                  Created {new Date(k.created_at).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => deleteKey(k.id)} className="text-xs text-red-400 hover:text-red-300">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
