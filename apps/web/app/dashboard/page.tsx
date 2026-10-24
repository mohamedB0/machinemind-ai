"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { machinesApi, conversationsApi, Machine, Conversation } from "@/lib/api";

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

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Navbar */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <span className="font-bold text-lg gradient-text">MachineMind AI</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.email}</span>
          <button onClick={logout}
            className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Machines", value: machines.length, icon: "🔧", color: "indigo" },
            { label: "Manuals", value: machines.reduce((s, m) => s + m.manual_count, 0), icon: "📄", color: "violet" },
            { label: "Conversations", value: conversations.length, icon: "💬", color: "emerald" },
          ].map(stat => (
            <div key={stat.label} className="glass rounded-2xl p-5 flex items-center gap-4">
              <div className="text-3xl">{stat.icon}</div>
              <div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Machines section */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Your Machines</h2>
            <Link href="/machines/new"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
              <span>+</span> Add Machine
            </Link>
          </div>

          {machines.length === 0 ? (
            <EmptyState icon="🔧" title="No machines yet" desc="Add your first machine to start uploading manuals." action="/machines/new" actionLabel="Add Machine" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {machines.map(m => (
                <Link key={m.id} href={`/machines/${m.id}`}
                  className="glass rounded-2xl p-5 hover:border-indigo-500/50 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-2xl">🔩</div>
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                      {m.manual_count} manual{m.manual_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">{m.name}</h3>
                  {m.manufacturer && <p className="text-sm text-gray-400 mt-0.5">{m.manufacturer}</p>}
                  {m.model_number && <p className="text-xs text-gray-500 mt-0.5">#{m.model_number}</p>}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent conversations */}
        {conversations.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Recent Conversations</h2>
            <div className="space-y-2">
              {conversations.slice(0, 5).map(c => (
                <Link key={c.id} href={`/chat/${c.id}`}
                  className="flex items-center gap-3 glass rounded-xl px-4 py-3 hover:border-indigo-500/30 transition-all group">
                  <span className="text-lg">💬</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 group-hover:text-white truncate">{c.title}</p>
                    <p className="text-xs text-gray-500">{new Date(c.updated_at).toLocaleDateString()}</p>
                  </div>
                  <span className="text-gray-600 group-hover:text-indigo-400">→</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc, action, actionLabel }: any) {
  return (
    <div className="glass rounded-2xl p-12 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-200 mb-1">{title}</h3>
      <p className="text-gray-400 text-sm mb-4">{desc}</p>
      <Link href={action}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
        {actionLabel}
      </Link>
    </div>
  );
}
