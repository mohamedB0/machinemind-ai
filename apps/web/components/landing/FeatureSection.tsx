"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type Feature = { icon: ReactNode; title: string; desc: string };

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M4 5.5 C4 4.5 4.5 4 5.5 4 H18.5 C19.5 4 20 4.5 20 5.5 V15 C20 16 19.5 16.5 18.5 16.5 H9.5 L5.5 20 V16.5 C4.5 16.5 4 16 4 15 Z" />
      <path d="M8 8.5 H16 M8 11.5 H13" opacity="0.7" />
    </svg>
  );
}

function IconDocCite() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M6 3 H14 L19 8 V19.5 C19 20.5 18.5 21 17.5 21 H6.5 C5.5 21 5 20.5 5 19.5 V4.5 C5 3.5 5.5 3 6 3 Z" />
      <path d="M14 3 V8 H19" />
      <path d="M8.5 13 H15.5 M8.5 16.5 H13" opacity="0.7" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12 H21" />
      <path d="M12 3 C9 6 9 18 12 21 C15 18 15 6 12 3" opacity="0.85" />
    </svg>
  );
}

const FEATURES: Feature[] = [
  {
    icon: <IconChat />,
    title: "Conversational answers",
    desc: "Ask in natural language and get clear, accurate answers based on your manual.",
  },
  {
    icon: <IconDocCite />,
    title: "Cited pages & sections",
    desc: "Every answer includes the exact page and section from the manual.",
  },
  {
    icon: <IconGlobe />,
    title: "Multilingual manuals",
    desc: "Work with technical documentation in English, French, and other supported languages.",
  },
];

export default function FeatureSection() {
  const reduced = useReducedMotion();

  return (
    <section id="features" className="scroll-mt-20 border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <div className="font-mono text-[11px] tracking-[0.3em] text-accent uppercase">What it does</div>
        </motion.div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.article
              key={f.title}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: reduced ? 0 : i * 0.08 }}
              className="group rounded-md border border-line bg-panel p-6 transition-colors duration-150 hover:border-line-hi hover:bg-raise"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xs border border-line bg-raise text-accent">
                {f.icon}
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mid">{f.desc}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
