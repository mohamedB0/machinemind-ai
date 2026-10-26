"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { IconMark } from "@/lib/icons";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Mark */}
        <div className="flex items-center gap-3 mb-8">
          <IconMark className="w-6 h-6 text-accent" />
          <div>
            <h1 className="text-lg font-semibold text-ink leading-none">MachineMind AI</h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-lo mt-1.5">
              Technical manual intelligence
            </p>
          </div>
        </div>

        {/* Panel */}
        <div className="border border-line rounded-xs bg-panel p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint border-b border-line pb-3 mb-5">
            Operator Access
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xs border border-fault/40 bg-fault/10 text-fault text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-lo mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-lo mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="input"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xs bg-accent hover:bg-accent-hi disabled:opacity-50 text-bg text-sm font-medium uppercase tracking-wider mt-2"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-lo">
          No account yet?{" "}
          <Link href="/register" className="text-accent hover:text-accent-hi font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
