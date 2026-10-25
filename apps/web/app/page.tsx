"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      router.replace(token ? "/dashboard" : "/login");
    }
  }, [token, isLoading]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex items-center gap-3">
        <span className="typing-dot w-2.5 h-2.5 bg-accent" />
        <span className="font-mono text-xs tracking-[0.2em] text-lo">INITIALIZING</span>
      </div>
    </div>
  );
}
