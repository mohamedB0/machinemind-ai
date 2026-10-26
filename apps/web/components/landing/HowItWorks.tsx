"use client";
import { motion, useReducedMotion } from "framer-motion";

const STEPS = [
  {
    n: "01",
    title: "Upload your manual.",
    desc: "Add the PDF of your industrial equipment — drives, inverters, machines.",
  },
  {
    n: "02",
    title: "The system extracts and indexes the content.",
    desc: "Text, tables, scanned pages and figures are parsed and embedded.",
  },
  {
    n: "03",
    title: "Ask a technical question.",
    desc: "In plain language, English or French — no keyword guessing.",
  },
  {
    n: "04",
    title: "Receive an answer with source citations.",
    desc: "Every reply points to the exact manual pages and sections used.",
  },
];

export default function HowItWorks() {
  const reduced = useReducedMotion();

  return (
    <section id="how" className="scroll-mt-20 border-t border-line bg-panel/40">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <motion.h2
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
        >
          From technical PDF to instant answers.
        </motion.h2>

        <ol className="mt-10 grid gap-8 md:grid-cols-4 md:gap-5">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.n}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: reduced ? 0 : i * 0.07 }}
              className="relative border-l-2 border-accent/40 pl-5 md:border-l-0 md:border-t-2 md:pl-0 md:pt-5"
            >
              <span className="absolute -left-[7px] top-0 h-3 w-3 rounded-full border-2 border-accent bg-bg md:-top-[7px] md:left-0" aria-hidden="true" />
              <div className="font-mono text-xs text-accent">{s.n}</div>
              <div className="mt-2 text-sm font-semibold text-ink">{s.title}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-mid">{s.desc}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
