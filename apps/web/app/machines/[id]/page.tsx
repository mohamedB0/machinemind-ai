"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { machinesApi, conversationsApi, Machine, Manual } from "@/lib/api";
import { IconBack, IconChat, IconUpload } from "@/lib/icons";

const pad = (n: number) => String(n).padStart(2, "0");

function MachinePage() {
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
    setPolling(mans.some(x => x.status === "pending" || x.status === "processing"));
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

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="typing-dot w-2.5 h-2.5 bg-accent" />
          <span className="font-mono text-xs tracking-[0.2em] text-lo">LOADING</span>
        </div>
      </div>
    );
  }
  if (!machine) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center font-mono text-xs uppercase tracking-widest text-lo">
        Machine not found
      </div>
    );
  }

  const completedManuals = manuals.filter(m => m.status === "completed");

  return (
    <div className="min-h-screen bg-bg">
      <nav className="border-b border-line px-6 py-3.5 flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-1.5 font-mono text-xs text-lo hover:text-ink uppercase tracking-wider">
          <IconBack className="w-3.5 h-3.5" /> Dashboard
        </Link>
        <span className="font-mono text-xs text-faint">/</span>
        <span className="text-sm font-medium text-ink truncate">{machine.name}</span>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Machine header */}
        <div className="border border-line rounded-xs bg-panel p-6 mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent mb-2">
                Unit {id.slice(0, 8).toUpperCase()}
              </div>
              <h1 className="text-xl font-semibold text-ink mb-3">{machine.name}</h1>
              <div className="space-y-1 font-mono text-xs">
                {machine.manufacturer && (
                  <div className="flex gap-2"><span className="text-faint uppercase tracking-wider w-24 shrink-0">Manufacturer</span><span className="text-mid">{machine.manufacturer}</span></div>
                )}
                {machine.model_number && (
                  <div className="flex gap-2"><span className="text-faint uppercase tracking-wider w-24 shrink-0">Model</span><span className="text-mid">{machine.model_number}</span></div>
                )}
              </div>
              {machine.description && <p className="text-sm text-lo mt-3">{machine.description}</p>}
            </div>
            {completedManuals.length > 0 && (
              <button
                onClick={startChat}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xs bg-accent hover:bg-accent-hi text-bg text-xs font-medium uppercase tracking-wider"
              >
                <IconChat className="w-4 h-4" /> Start Chat
              </button>
            )}
          </div>
        </div>

        {/* Manuals */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-ink">Manuals</h2>
            <span className="font-mono text-xs text-faint">{pad(manuals.length)}</span>
            <div className="flex-1 h-px bg-line" />
            {polling && (
              <span className="typing-dot w-1.5 h-1.5 bg-accent" aria-label="Indexing" />
            )}
            <label className="flex items-center gap-2 px-3.5 py-2 rounded-xs border border-line hover:border-line-hi text-mid hover:text-ink text-xs font-mono uppercase tracking-wider cursor-pointer">
              {uploading ? (
                <><span className="typing-dot w-1.5 h-1.5 bg-accent" /> Indexing…</>
              ) : (
                <>
                  <IconUpload className="w-3.5 h-3.5" /> Upload PDF
                </>
              )}
              <input type="file" accept=".pdf" onChange={handleUpload} disabled={uploading} className="hidden" />
            </label>
          </div>

          {uploadError && (
            <div className="mb-4 px-4 py-3 rounded-xs border border-fault/40 bg-fault/10 text-fault text-sm">
              {uploadError}
            </div>
          )}

          {manuals.length === 0 ? (
            <div className="border border-line rounded-xs bg-panel px-6 py-12 text-center">
              <p className="text-sm font-medium text-ink mb-1">No manuals yet</p>
              <p className="text-sm text-lo">Upload a PDF to start asking questions</p>
            </div>
          ) : (
            <div className="border border-line rounded-xs divide-y divide-line bg-panel">
              {/* Table head */}
              <div className="hidden sm:grid grid-cols-[1fr_5rem_5rem_7rem] gap-3 px-4 sm:px-5 py-2 border-b border-line font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                <span>Document</span>
                <span className="text-right">Pages</span>
                <span className="text-right">Size</span>
                <span className="text-right">Status</span>
              </div>
              {manuals.map(m => (
                <div key={m.id} className="grid sm:grid-cols-[1fr_5rem_5rem_7rem] gap-2 sm:gap-3 px-4 sm:px-5 py-4 items-center hover:bg-raise">
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">{m.original_filename}</p>
                    {m.error_message && (
                      <p className="font-mono text-[11px] text-fault mt-1 truncate">{m.error_message}</p>
                    )}
                    <div className="sm:hidden flex gap-3 mt-1 font-mono text-[11px] text-faint">
                      {m.page_count && <span>{m.page_count} pages</span>}
                      {m.file_size && <span>{(m.file_size / 1024 / 1024).toFixed(1)} MB</span>}
                    </div>
                  </div>
                  {m.page_count ? (
                    <span className="hidden sm:block font-mono text-xs text-mid text-right">{m.page_count}</span>
                  ) : (
                    <span className="hidden sm:block font-mono text-xs text-faint text-right">—</span>
                  )}
                  <span className="hidden sm:block font-mono text-xs text-lo text-right">
                    {m.file_size ? `${(m.file_size / 1024 / 1024).toFixed(1)} MB` : "—"}
                  </span>
                  <div className="flex sm:justify-end">
                    <StatusBadge status={m.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    pending:    { cls: "status-pending",    label: "Pending" },
    processing: { cls: "status-processing", label: "Processing" },
    completed:  { cls: "status-completed",  label: "Ready" },
    error:      { cls: "status-error",      label: "Error" },
  };
  const s = map[status] || map.pending;
  const dot = status === "processing"
    ? <span className="typing-dot w-1 h-1 bg-accent" />
    : status === "completed"
      ? <span className="w-1 h-1 bg-ok" />
      : status === "error"
        ? <span className="w-1 h-1 bg-fault" />
        : <span className="w-1 h-1 bg-lo" />;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-xs text-[10px] uppercase tracking-wider ${s.cls}`}>
      {dot} {s.label}
    </span>
  );
}

export default function MachinePageRoute() {
  return (
    <Suspense fallback={null}>
      <MachinePage />
    </Suspense>
  );
}
