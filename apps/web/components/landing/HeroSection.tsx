"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import HeroVisual from "./HeroVisual";

const EASE = [0.22, 0.61, 0.36, 1] as const;

export default function HeroSection() {
  const reduced = useReducedMotion();

  const rise = (delay = 0) => ({
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0.01 : 0.55, delay, ease: EASE },
  });

  return (
    <section className="relative overflow-hidden">
      {/* faint grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 80% 65% at 55% 40%, black 30%, transparent 75%)",
        }}
      />
      <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-6 lg:pb-24 lg:pt-16">
        {/* ── Left: copy ── */}
        <div className="relative z-10 max-w-xl">
          <motion.div {...rise(0)}>
            <div className="inline-flex items-center gap-2 rounded-xs border border-line bg-panel px-3 py-1.5">
              <span className="w-1.5 h-1.5 bg-accent" aria-hidden="true" />
              <span className="font-mono text-[10px] tracking-[0.28em] text-mid uppercase">Built for maintenance teams</span>
            </div>
          </motion.div>

          <motion.h1 {...rise(0.08)} className="mt-6 text-4xl font-semibold leading-[1.06] tracking-tight sm:text-5xl xl:text-6xl">
            Your machine manuals, finally <span className="text-accent">conversational.</span>
          </motion.h1>

          <motion.p {...rise(0.16)} className="mt-5 max-w-lg text-[15px] leading-relaxed text-mid sm:text-base">
            MachineMind AI ingests your industrial equipment PDFs and turns them into a
            precise technical assistant. Ask how to reset a fault, wire a drive or decode
            an error code — the answer comes with the exact page it came from.
          </motion.p>

          <motion.div {...rise(0.24)} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2 rounded-xs bg-accent px-6 py-3 text-sm font-semibold text-black hover:bg-accent-hi sm:justify-start"
            >
              Get started
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5">
                <path d="M2.5 7.5 H12 M8 3.5 L12 7.5 L8 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xs border border-line px-6 py-3 text-sm text-mid hover:border-accent hover:text-ink"
            >
              I already have an account
            </Link>
          </motion.div>

          <motion.div {...rise(0.32)} className="mt-5 font-mono text-[11px] text-lo">
            No credit card required &middot; English &amp; French &middot; Real page citations
          </motion.div>
        </div>

        {/* ── Right: 3D scene ── */}
        <motion.div {...rise(0.2)} className="relative">
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}
