"use client";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";

const NAV = [
  { href: "/", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
];

const STACK = "px-1 py-1 font-mono text-[12px] tracking-[0.08em] text-mid hover:text-ink relative group";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-bg/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5" aria-label="Main">
        <Link href="/" aria-label="MachineMind AI — home">
          <Logo />
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {NAV.map(n => (
            <Link key={n.label} href={n.href} className={STACK}>
              {n.label}
              <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-accent transition-[width] duration-150 group-hover:w-full" />
            </Link>
          ))}
          <div className="ml-2 hidden items-center gap-3 md:flex">
            <Link href="/login" className="rounded-xs px-3 py-2 font-mono text-[12px] text-mid hover:text-ink">
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-xs bg-accent px-3.5 py-2 font-mono text-[12px] font-medium text-black hover:bg-accent-hi"
            >
              Create account
            </Link>
          </div>
        </div>

        <button
          className="md:hidden rounded-xs border border-line p-2 text-ink"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            {open ? (
              <path d="M4 4 L14 14 M14 4 L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="M2 5 H16 M2 9 H16 M2 13 H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-line bg-bg px-5 pb-5 pt-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV.map(n => (
              <Link
                key={n.label}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-xs px-2 py-2.5 font-mono text-[13px] text-mid hover:bg-raise hover:text-ink"
              >
                {n.label}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Link href="/login" onClick={() => setOpen(false)} className="rounded-xs border border-line px-3 py-2.5 text-center text-sm text-ink">
              Sign in
            </Link>
            <Link href="/register" onClick={() => setOpen(false)} className="rounded-xs bg-accent px-3 py-2.5 text-center text-sm font-semibold text-black">
              Create account
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
