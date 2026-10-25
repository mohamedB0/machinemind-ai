"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { machinesApi, conversationsApi, Machine, Conversation } from "@/lib/api";
import { IconMark, IconMachine, IconChat, IconPlus, IconChevron } from "@/lib/icons";

const pad = (n: number) => String(n).padStart(2, "0");

export default function DashboardPage() {
  const { token, user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !token) router.push("/login");
  }, [token, isLoading]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      machinesApi.list(token),
      conversationsApi.list(token),
    ]).then(([m, c]) => {
      setMachines(m as Machine[]);
      setConversations(c as Conversation[]);
    }).finally(() => setLoading(false));
  }, [token]);

  if (isLoading || loading) return <LoadingScreen />;

  const manualCount = machines.reduce((s, m) => s + m.manual_count, 0);

  return (
    <div className="min-h-screen bg-bg">
      {/* Navbar */}
      <nav className="border-b border-line px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <IconMark className="w-5 h-5 text-accent" />
          <span className="font-semibold text-[15px] tracking-tight text-ink">MachineMind AI</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-lo hidden sm:inline">{user?.email}</span>
          <button
            onClick={logout}
            className="font-mono text-xs text-mid hover:text-ink border border-line hover:border-line-hi rounded-xs px-3 py-1.5 uppercase tracking-wider"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stat strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 border border-line rounded-xs divide-y sm:divide-y-0 sm:divide-x divide-line bg-panel mb-10">
          {[
            { label: "Machines", value: machines.length },
            { label: "Manuals", value: manualCount },
            { label: "Conversations", value: conversations.length },
          ].map(stat => (
            <div key={stat.label} className="px-5 py-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-lo mb-1.5">{stat.label}</div>
              <div className="text-2xl font-semibold text-ink tabular-nums leading-none">{pad(stat.value)}</div>
            </div>
          ))}
        </div>

        {/* Machines */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-ink">Your Machines</h2>
            <span className="font-mono text-xs text-faint">{pad(machines.length)}</span>
            <div className="flex-1 h-px bg-line" />
            <Link
              href="/machines/new"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xs bg-accent hover:bg-accent-hi text-bg text-xs font-medium uppercase tracking-wider"
            >
              <IconPlus className="w-3.5 h-3.5" /> Add Machine
            </Link>
          </div>

          {machines.length === 0 ? (
            <EmptyState
              icon={<IconMachine className="w-8 h-8 text-faint" />}
              title="No machines yet"
              desc="Add your first machine to start uploading manuals."
              action="/machines/new"
              actionLabel="Add Machine"
            />
          ) : (
            <div className="border border-line rounded-xs divide-y divide-line bg-panel">
              {machines.map((m, i) => (
                <Link
                  key={m.id}
                  href={`/machines/${m.id}`}
                  className="flex items-center gap-4 px-4 sm:px-5 py-4 hover:bg-raise group"
                >
                  <span className="font-mono text-xs text-faint w-6 shrink-0">{pad(i + 1)}</span>
                  <IconMachine className="text-lo group-hover:text-accent w-4.5 h-4.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-mid group-hover:text-ink truncate leading-none">{m.name}</p>
                    {m.manufacturer && (
                      <p className="text-xs text-faint mt-1 truncate">{m.manufacturer}</p>
                    )}
                  </div>
                  {m.model_number && (
                    <span className="hidden sm:inline font-mono text-xs text-faint">{m.model_number}</span>
                  )}
                  <span className="font-mono text-[10px] text-mid border border-line rounded-xs px-2 py-1 uppercase tracking-wider whitespace-nowrap">
                    {m.manual_count} manual{m.manual_count !== 1 ? "s" : ""}
                  </span>
                  <IconChevron className="text-faint group-hover:text-mid w-4 h-4 -rotate-90" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Recent conversations */}
        {conversations.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-ink">Recent Conversations</h2>
              <span className="font-mono text-xs text-faint">{pad(Math.min(conversations.length, 5))}</span>
              <div className="flex-1 h-px bg-line" />
            </div>
            <div className="border border-line rounded-xs divide-y divide-line bg-panel">
              {conversations.slice(0, 5).map((c, i) => (
                <Link
                  key={c.id}
                  href={`/chat/${c.id}`}
                  className="flex items-center gap-4 px-4 sm:px-5 py-3.5 hover:bg-raise group"
                >
                  <span className="font-mono text-xs text-faint w-6 shrink-0">{pad(i + 1)}</span>
                  <IconChat className="text-lo group-hover:text-accent w-4.5 h-4.5" />
                  <p className="flex-1 min-w-0 text-sm text-mid group-hover:text-ink truncate">{c.title}</p>
                  <span className="font-mono text-xs text-faint whitespace-nowrap">
                    {new Date(c.updated_at).toLocaleDateString()}
                  </span>
                  <IconChevron className="text-faint group-hover:text-mid w-4 h-4 -rotate-90" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex items-center gap-3">
        <span className="typing-dot w-2.5 h-2.5 bg-accent" />
        <span className="font-mono text-xs tracking-[0.2em] text-lo">LOADING</span>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc, action, actionLabel }: {
  icon: ReactNode;
  title: string;
  desc: string;
  action: string;
  actionLabel: string;
}) {
  return (
    <div className="border border-line rounded-xs bg-panel px-6 py-14 text-center">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="text-sm font-semibold text-ink mb-1">{title}</h3>
      <p className="text-sm text-lo mb-5">{desc}</p>
      <Link
        href={action}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xs bg-accent hover:bg-accent-hi text-bg text-xs font-medium uppercase tracking-wider"
      >
        <IconPlus className="w-3.5 h-3.5" /> {actionLabel}
      </Link>
    </div>
  );
}
