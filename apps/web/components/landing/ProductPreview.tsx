"use client";
import { motion, useReducedMotion } from "framer-motion";

export default function ProductPreview() {
  const reduced = useReducedMotion();

  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="font-mono text-[11px] tracking-[0.3em] text-accent uppercase">Product preview</div>
          <p className="mt-3 text-sm text-mid">Demonstration — fictional example, not a real technical instruction.</p>
        </motion.div>

        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: reduced ? 0 : 0.1 }}
          className="mx-auto mt-8 max-w-2xl rounded-md border border-line bg-panel p-5 sm:p-7"
        >
          <div className="mb-4 flex items-center gap-2 border-b border-line pb-3">
            <span className="h-2 w-2 rounded-full bg-ok/70" aria-hidden="true" />
            <span className="font-mono text-[11px] text-lo">MachineMind AI — Conversations</span>
          </div>

          {/* user question */}
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-xs border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm text-ink">
              How do I replace the air filter?
            </div>
          </div>

          {/* assistant answer */}
          <div className="mt-4 flex justify-start">
            <div className="max-w-[85%] rounded-xs border border-line bg-raise px-4 py-3 text-sm leading-relaxed text-ink">
              Switch off the machine, isolate the power supply, and follow the replacement
              procedure described in the maintenance section.
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] tracking-wider uppercase text-lo">Source</span>
                <span className="inline-flex items-center gap-1.5 rounded-xs border border-line bg-bg px-2.5 py-1 font-mono text-[11px] text-mid">
                  Maintenance Manual &middot; Page 42 &middot; Section 5.2
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xs border border-ok/30 bg-ok/5 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ok">
                  High confidence
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
