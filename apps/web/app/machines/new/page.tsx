"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { machinesApi } from "@/lib/api";

export default function NewMachinePage() {
  const { token } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", manufacturer: "", model_number: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const machine = await machinesApi.create({
        name: form.name,
        manufacturer: form.manufacturer || undefined,
        model_number: form.model_number || undefined,
        description: form.description || undefined,
      }, token);
      router.push(`/machines/${(machine as any).id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">← Dashboard</Link>
        <span className="text-gray-700">/</span>
        <span className="text-white text-sm font-medium">New Machine</span>
      </nav>

      <main className="max-w-lg mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-white mb-6">Add a new machine</h1>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-900/40 border border-red-700/50 text-red-300 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-5">
          {[
            { key: "name", label: "Machine name *", placeholder: "CNC Mill XR-500", required: true },
            { key: "manufacturer", label: "Manufacturer", placeholder: "Haas Automation" },
            { key: "model_number", label: "Model number", placeholder: "XR-500-2023" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">{f.label}</label>
              <input
                type="text"
                value={(form as any)[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                required={f.required}
                placeholder={f.placeholder}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="Brief description of this machine and its purpose…"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-colors">
            {loading ? "Creating…" : "Create Machine"}
          </button>
        </form>
      </main>
    </div>
  );
}
