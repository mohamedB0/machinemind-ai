"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { GearMark } from "./Logo";

export default function FinalCTA() {
  const reduced = useReducedMotion();

  return (
    <section className="relative overflow-hidden border-t border-line">
      {/* orange glow */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{ background: "radial-gradient(ellipse 55% 60% at 50% 70%, rgba(255,100,31,0.14) 0%, transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-6xl px-5 py-20 text-center lg:py-24">
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-md border border-accent/25 bg-panel text-accent" style={{ boxShadow: "0 0 42px rgba(255,100,31,0.22)" }}>
            <GearMark className="h-6 w-6" />
          </div>
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Your manuals know the answer. <span className="text-accent">Now you can ask.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-mid sm:text-base">
            Turn technical documentation into a searchable, conversational knowledge base.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-xs bg-accent px-7 py-3.5 text-sm font-semibold text-black hover:bg-accent-hi"
            style={{ boxShadow: "0 0 34px rgba(255,100,31,0.25)" }}
          >
            Get started
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
