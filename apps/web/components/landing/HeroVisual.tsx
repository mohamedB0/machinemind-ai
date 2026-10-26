"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const HeroScene3D = dynamic(() => import("./HeroScene3D"), {
  ssr: false,
  loading: () => <StaticGearPose label="LOADING SCENE" />,
});

function StaticGearPose({ label }: { label?: string }) {
  return (
    <div className="relative h-full w-full flex items-center justify-center">
      <div className="absolute inset-8 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,100,31,0.18) 0%, transparent 65%)" }} />
      <svg viewBox="0 0 64 64" className="w-56 h-56 text-accent opacity-90">
        <g transform="rotate(12 32 32)">
          <circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth="1" opacity="0.3" fill="none" />
          <circle cx="32" cy="32" r="21" strokeWidth="1.6" fill="none" stroke="currentColor" opacity="0.55" />
          {Array.from({ length: 16 }).map((_, i) => {
            const a = (i / 16) * Math.PI * 2;
            const x1 = 32 + Math.cos(a) * 21, y1 = 32 + Math.sin(a) * 21;
            const x2 = 32 + Math.cos(a) * 25.5, y2 = 32 + Math.sin(a) * 25.5;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="2.2" />;
          })}
          <circle cx="32" cy="32" r="9.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
          <circle cx="28" cy="30" r="1.8" fill="currentColor" />
          <circle cx="36" cy="30" r="1.8" fill="currentColor" />
          <circle cx="32" cy="35" r="1.8" fill="currentColor" />
          <path d="M28 30 H32 V35 M36 30 H33.5 M36 30 L32 33.5 M28 31.5 L31 33.6" stroke="currentColor" strokeWidth="1.2" opacity="0.8" />
        </g>
      </svg>
      {label && <div className="absolute bottom-6 font-mono text-[10px] tracking-[0.3em] text-faint">{label}</div>}
    </div>
  );
}

const HUD_LEFT = [
  { pos: "top-[12%] left-[2%]", label: "INDUSTRIAL EQUIPMENT" },
  { pos: "top-[52%] left-[-2%]", label: "PDF → KNOWLEDGE" },
  { pos: "bottom-[16%] left-[10%]", label: "RAG + AI" },
];
const HUD_RIGHT = [
  { pos: "top-[24%] right-[2%]", label: "SEARCH · RETRIEVE · GENERATE" },
  { pos: "bottom-[26%] right-[4%]", label: "ACCURATE ANSWERS" },
];

function HudLabels() {
  const line = "h-px bg-accent/40";
  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
      {HUD_LEFT.map(h => (
        <div key={h.label} className={`absolute ${h.pos} flex items-center gap-2`}>
          <span className={`w-10 ${line}`} />
          <span className="font-mono text-[10px] tracking-[0.22em] text-mid">{h.label}</span>
        </div>
      ))}
      {HUD_RIGHT.map(h => (
        <div key={h.label} className={`absolute ${h.pos} flex items-center gap-2`}>
          <span className="font-mono text-[10px] tracking-[0.22em] text-mid">{h.label}</span>
          <span className={`w-10 ${line}`} />
        </div>
      ))}
    </div>
  );
}

export default function HeroVisual() {
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const id = requestAnimationFrame(() => {
      setReduced(mq.matches);
      try {
        const c = document.createElement("canvas");
        setWebgl(!!(c.getContext("webgl2") || c.getContext("webgl")));
      } catch {
        setWebgl(false);
      }
      setReady(true);
    });
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => {
      cancelAnimationFrame(id);
      mq.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <div className="relative h-[380px] w-full sm:h-[440px] lg:h-[600px]">
      {/* radial orange glow */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(255,100,31,0.20) 0%, rgba(255,100,31,0.06) 38%, transparent 68%)" }} aria-hidden="true" />
      {ready && webgl ? (
        <HeroScene3D reduced={reduced} />
      ) : (
        <StaticGearPose />
      )}
      <HudLabels />
    </div>
  );
}
