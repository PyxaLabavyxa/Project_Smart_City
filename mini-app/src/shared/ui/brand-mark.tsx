import type { CSSProperties } from "react";

export function BrandMark({ size = 46, className }: { size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" style={{ color: "var(--color-ink)" } as CSSProperties}>
    <path d="M5 23 24 5l19 18M10 19v22a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 42V33a5 5 0 0 1 10 0v9" fill="var(--color-primary)" opacity=".55" />
  </svg>;
}
