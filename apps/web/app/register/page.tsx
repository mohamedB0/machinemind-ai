"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { IconMark } from "@/lib/icons";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.register(email, password, fullName);
      router.push("/login?registered=1");
    } catch (err: any) {
      setError(err.message || "Registration failed");
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
              Create operator account
            </p>
          </div>
        </div>

        {/* Panel */}
        <div className="border border-line rounded-xs bg-panel p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint border-b border-line pb-3 mb-5">
            New Operator
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xs border border-fault/40 bg-fault/10 text-fault text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-lo mb-1.5">Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="input"
                placeholder="John Doe"
              />
            </div>
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
                minLength={8}
                className="input"
                placeholder="Min. 8 characters"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xs bg-accent hover:bg-accent-hi disabled:opacity-50 text-bg text-sm font-medium uppercase tracking-wider mt-2"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-lo">
          Already registered?{" "}
          <Link href="/login" className="text-accent hover:text-accent-hi font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
