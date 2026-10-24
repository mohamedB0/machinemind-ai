"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { machinesApi, conversationsApi, Machine, Manual } from "@/lib/api";

export default function MachinePage() {
  const { id } = useParams<{ id: string }>();
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const [machine, setMachine] = useState<Machine | null>(null);
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  useEffect(() => { if (!isLoading && !token) router.push("/login"); }, [token, isLoading]);

  const fetchData = async () => {
    if (!token) return;
    const [m, mans] = await Promise.all([
      machinesApi.get(id, token),
      machinesApi.listManuals(id, token),
    ]);
    setMachine(m as Machine);
    setManuals(mans as Manual[]);
  };

  useEffect(() => {
    if (!token) return;
    fetchData().finally(() => setLoading(false));
  }, [token, id]);

  // Poll for processing manuals
  useEffect(() => {
    const processing = manuals.some(m => m.status === "pending" || m.status === "processing");
    if (!processing || !token) return;
    const interval = setInterval(() => fetchData(), 3000);
    return () => clearInterval(interval);
  }, [manuals, token]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    setUploadError("");
    try {
      await machinesApi.uploadManual(id, file, token);
      await fetchData();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const startChat = async () => {
    if (!token || !machine) return;
    try {
      const conv = await conversationsApi.create(id, `Chat about ${machine.name}`, token);
      router.push(`/chat/${(conv as any).id}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (isLoading || loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!machine) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Machine not found</div>;

  const completedManuals = manuals.filter(m => m.status === "completed");

  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">← Dashboard</Link>
        <span className="text-gray-700">/</span>
        <span className="text-white text-sm font-medium">{machine.name}</span>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Machine header */}
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">🔩</span>
                <h1 className="text-2xl font-bold text-white">{machine.name}</h1>
              </div>
              {machine.manufacturer && <p className="text-gray-300">{machine.manufacturer}</p>}
              {machine.model_number && <p className="text-sm text-gray-500">Model: {machine.model_number}</p>}
              {machine.description && <p className="text-sm text-gray-400 mt-2">{machine.description}</p>}
            </div>
            {completedManuals.length > 0 && (
              <button onClick={startChat}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors">
                <span>💬</span> Start Chat
              </button>
            )}
          </div>
        </div>

        {/* Manuals */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Manuals ({manuals.length})</h2>
            <label className={`flex items-center gap-2 px-4 py-2 rounded-xl ${uploading ? "bg-gray-700 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500 cursor-pointer"} text-white text-sm font-medium transition-colors`}>
              {uploading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading…</>
              ) : (
                <><span>↑</span> Upload PDF</>
              )}
              <input type="file" accept=".pdf" onChange={handleUpload} disabled={uploading} className="hidden" />
            </label>
          </div>

          {uploadError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-900/40 border border-red-700/50 text-red-300 text-sm">
              {uploadError}
            </div>
          )}

          {manuals.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-gray-300 font-medium mb-1">No manuals yet</p>
              <p className="text-gray-500 text-sm">Upload a PDF to start asking questions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {manuals.map(m => (
                <div key={m.id} className="glass rounded-xl px-5 py-4 flex items-center gap-4">
                  <div className="text-2xl">📄</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{m.original_filename}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {m.page_count && <span className="text-xs text-gray-400">{m.page_count} pages</span>}
                      {m.file_size && <span className="text-xs text-gray-500">{(m.file_size / 1024 / 1024).toFixed(1)} MB</span>}
                      {m.language && <span className="text-xs text-gray-500">{m.language}</span>}
                    </div>
                    {m.error_message && <p className="text-xs text-red-400 mt-1 truncate">{m.error_message}</p>}
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string; icon: string }> = {
    pending:    { cls: "status-pending",    label: "Pending",    icon: "⏳" },
    processing: { cls: "status-processing", label: "Processing", icon: "⚙️" },
    completed:  { cls: "status-completed",  label: "Ready",      icon: "✓" },
    error:      { cls: "status-error",      label: "Error",      icon: "✕" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}
