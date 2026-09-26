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
} as const;
export function Icon({ name, size = 21, style }: { name: keyof typeof paths; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
