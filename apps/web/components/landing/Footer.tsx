"use client";
import Link from "next/link";
import { Logo } from "./Logo";

const PRODUCT_LINKS = [
  { href: "/", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
];

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-mid">
            An AI technical assistant that reads your industrial equipment manuals and answers
            with precise, page-cited replies.
          </p>
        </div>

        <nav aria-label="Product">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-faint">Product</div>
          <ul className="mt-4 space-y-2.5">
            {PRODUCT_LINKS.map(l => (
              <li key={l.label}>
                <Link href={l.href} className="text-sm text-mid hover:text-ink">{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-faint">Account</div>
          <ul className="mt-4 space-y-2.5">
            <li><Link href="/login" className="text-sm text-mid hover:text-ink">Sign in</Link></li>
            <li><Link href="/register" className="text-sm text-mid hover:text-ink">Create account</Link></li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-line py-6 text-center">
        <div className="font-mono text-[10px] tracking-[0.25em] text-faint uppercase">
          MachineMind AI &middot; RAG over industrial documentation
        </div>
      </div>
    </footer>
  );
}
