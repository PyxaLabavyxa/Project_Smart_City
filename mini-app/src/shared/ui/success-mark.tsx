import type { CSSProperties } from "react";
import styles from "./success-mark.module.css";

const particles = [
  ["-.62em", "-.37em", "-24deg"], ["-.35em", "-.64em", "18deg"],
  [".04em", "-.73em", "-12deg"], [".43em", "-.57em", "30deg"],
  [".69em", "-.23em", "-18deg"], [".66em", ".23em", "25deg"],
  [".39em", ".58em", "-25deg"], ["-.08em", ".69em", "15deg"],
  ["-.49em", ".49em", "-30deg"], ["-.71em", ".08em", "20deg"],
];

/** Decorative feedback: mount only after the server confirms the action. */
export function SuccessMark({ className = "" }: { className?: string }) {
  return <span className={`${styles.mark} ${className}`} aria-hidden="true">
    <span className={styles.halo} />
    <span className={styles.disc} />
    <svg className={styles.tick} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
    {particles.map(([x, y, rotation], index) => <span key={index} className={styles.particle} style={{ "--x": x, "--y": y, "--rotation": rotation, "--delay": `${120 + index % 3 * 35}ms` } as CSSProperties} />)}
  </span>;
}
