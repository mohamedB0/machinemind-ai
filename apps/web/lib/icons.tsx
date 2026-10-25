import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      className={className ?? "w-4 h-4 shrink-0"}
    >
      {children}
    </svg>
  );
}

export function IconMark({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.5 1.5M16.2 16.2l1.5 1.5M17.7 6.3l-1.5 1.5M7.8 16.2l-1.5 1.5" />
      <path d="M12 12l3.5-3.5" strokeWidth={2} />
    </Svg>
  );
}

export function IconMachine({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M4 7.5L12 12l8-4.5M12 12v9" />
    </Svg>
  );
}

export function IconDoc({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 3h9l4 4v14H6V3z" />
      <path d="M15 3v4h4" />
    </Svg>
  );
}

export function IconChat({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 4h16v11h-9l-4 4v-4H4V4z" />
      <path d="M8 8h8M8 11h5" />
    </Svg>
  );
}

export function IconUser({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
    </Svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconUpload({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 14V4M8 8l4-4 4 4" />
      <path d="M4 15v5h16v-5" />
    </Svg>
  );
}

export function IconArrowUp({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Svg>
  );
}

export function IconChevron({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8 10l4 4 4-4" />
    </Svg>
  );
}

export function IconArrowOut({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 17L17 7M9 7h8v8" />
    </Svg>
  );
}

export function IconBack({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Svg>
  );
}
