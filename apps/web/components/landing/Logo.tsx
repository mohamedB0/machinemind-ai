type Props = { className?: string };

export function GearMark({ className }: Props) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      {/* Gear body — 8 teeth */}
      <path
        d="M32 6
           L37 6 L39 12 A20 20 0 0 1 47 16 L53 13 L57 17 L54 23
           A20 20 0 0 1 58 32
           L58 32 A20 20 0 0 1 54 41 L57 47 L53 51 L47 48
           A20 20 0 0 1 39 52 L37 58 L32 58 L27 58 L25 52
           A20 20 0 0 1 17 48 L11 51 L7 47 L10 41
           A20 20 0 0 1 6 32
           A20 20 0 0 1 10 23 L7 17 L11 13 L17 16
           A20 20 0 0 1 25 12 L27 6 Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M32 6 L37 6 L39 12 A20 20 0 0 1 47 16 L53 13 L57 17 L54 23 A20 20 0 0 1 58 32 A20 20 0 0 1 54 41 L57 47 L53 51 L47 48 A20 20 0 0 1 39 52 L37 58 L32 58 L27 58 L25 52 A20 20 0 0 1 17 48 L11 51 L7 47 L10 41 A20 20 0 0 1 6 32 A20 20 0 0 1 10 23 L7 17 L11 13 L17 16 A20 20 0 0 1 25 12 L27 6 Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Bore */}
      <circle cx="32" cy="32" r="9" stroke="currentColor" strokeWidth="2.5" />
      {/* Circuit nodes — AI brain pattern inside bore */}
      <circle cx="26.5" cy="29" r="2.4" fill="currentColor" />
      <circle cx="37.5" cy="29" r="2.4" fill="currentColor" />
      <circle cx="32" cy="37" r="2.4" fill="currentColor" />
      <path d="M26.5 29 H32 V37 M37.5 29 L34.5 29 M37.5 29 L32 34 M26.5 31 L30 33.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      {/* Teeth ticks */}
      <path d="M10 23 L10 23 M54 23 L54 23" stroke="currentColor" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="text-accent shrink-0">
        <GearMark className={compact ? "w-6 h-6" : "w-8 h-8"} />
      </span>
      <span className="leading-none">
        <span className={`block font-semibold tracking-tight text-ink ${compact ? "text-sm" : "text-[15px]"}`}>
          MachineMind <span className="text-accent">AI</span>
        </span>
        <span className="block font-mono text-[9px] tracking-[0.28em] text-lo uppercase mt-1">
          Technical manual intelligence
        </span>
      </span>
    </span>
  );
}
