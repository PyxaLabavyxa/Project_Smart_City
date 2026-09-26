import type { CSSProperties } from "react";
const paths = {
  home: "m3 10 9-7 9 7v11h-6v-7H9v7H3Z",
  issues: "M9 4H5v17h14V4h-4M9 2h6v5H9ZM8 12h8M8 16h6",
  plan: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16m6-14v16",
  cameras: "M3 6h12v12H3Zm12 4 6-3v10l-6-3Z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  messages: "M4 3h13v12H9l-5 4Zm13 5h4v13l-5-3h-4",
  calendar: "M4 5h16v16H4ZM8 3v4m8-4v4M4 10h16m-12 4h2m4 0h2m-8 4h2",
  check: "m5 12 4 4L19 6",
  health: "M3 12h4l3-8 4 16 3-8h4",
  company: "M3 7h18v14H3ZM8 7V3h8v4M3 12h18M10 12v3h4v-3",
  lock: "M5 10h14v11H5ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3",
  arrow: "m9 5 7 7-7 7",
  send: "m3 3 18 9-18 9 4-9Zm4 9h14",
  refresh: "M20 8a8 8 0 1 0 0 8M20 3v5h-5",
  play: "m9 5 11 7-11 7Z",
  warning: "m12 3 10 18H2ZM12 9v5m0 3h.01",
  close: "m6 6 12 12M6 18 18 6",
  trend: "m3 17 6-6 4 4 8-10m-6 0h6v6",
} as const;
export function Icon({ name, size = 21, style }: { name: keyof typeof paths; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
