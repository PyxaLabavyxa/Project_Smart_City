"use client";

import { useState, type ButtonHTMLAttributes } from "react";
import { Icon } from "./icon";
import styles from "./refresh-button.module.css";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  onRefresh: () => void | Promise<unknown>;
  loading?: boolean;
  iconSize?: number;
};

export function RefreshButton({ onRefresh, loading = false, iconSize = 18, children, disabled, className, ...props }: Props) {
  const [pending, setPending] = useState(false);
  const [cycle, setCycle] = useState(0);
  const active = pending || loading;
  async function refresh() {
    if (disabled || active) return;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setCycle(value => value + 1);
    setPending(true);
    try { await onRefresh(); }
    finally { setPending(false); }
  }
  return <button {...props} className={`${styles.button} ${className ?? ""}`} type="button" onClick={() => void refresh()} disabled={disabled || active} aria-busy={active}>
    <span key={cycle} className={`${styles.icon} ${active || cycle ? styles.spinning : ""}`}
      onAnimationIteration={() => { if (!active) setCycle(0); }}>
      <Icon name="refresh" size={iconSize} />
    </span>{children}
  </button>;
}
