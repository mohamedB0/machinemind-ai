"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { machinesApi } from "@/lib/api";
import { IconBack } from "@/lib/icons";

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
      router.push(`/machines/${machine.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create machine");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <nav className="border-b border-line px-6 py-3.5 flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-1.5 font-mono text-xs text-lo hover:text-ink uppercase tracking-wider">
          <IconBack className="w-3.5 h-3.5" /> Dashboard
        </Link>
        <span className="font-mono text-xs text-faint">/</span>
        <span className="text-sm font-medium text-ink">New Machine</span>
      </nav>

      <main className="max-w-lg mx-auto px-6 py-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent mb-2">Unit Registration</div>
        <h1 className="text-xl font-semibold text-ink mb-6">Add a new machine</h1>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xs border border-fault/40 bg-fault/10 text-fault text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="border border-line rounded-xs bg-panel p-6 space-y-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint border-b border-line pb-3">
            Machine Record
          </div>
          {([
            { key: "name", label: "Machine name", placeholder: "CNC Mill XR-500", required: true },
            { key: "manufacturer", label: "Manufacturer", placeholder: "Haas Automation", required: false },
            { key: "model_number", label: "Model number", placeholder: "XR-500-2023", required: false },
          ] as { key: "name" | "manufacturer" | "model_number"; label: string; placeholder: string; required: boolean }[]).map(f => (
            <div key={f.key}>
              <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-lo mb-1.5">
                {f.label}{f.required && <span className="text-accent"> *</span>}
              </label>
              <input
                type="text"
                value={form[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                required={f.required}
                placeholder={f.placeholder}
                className="input"
              />
            </div>
          ))}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-lo mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="Brief description of this machine and its purpose…"
              className="input resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xs bg-accent hover:bg-accent-hi disabled:opacity-50 text-bg text-sm font-medium uppercase tracking-wider"
          >
            {loading ? "Creating…" : "Create Machine"}
          </button>
        </form>
      </main>
    </div>
  );
}
