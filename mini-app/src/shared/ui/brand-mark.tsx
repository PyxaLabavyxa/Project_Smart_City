import Image from "next/image";
import styles from "./brand-mark.module.css";

export function BrandMark({ size = 46, className }: { size?: number; className?: string }) {
  return <Image className={className} src="/images/brand/app-icon.png" alt="" width={size} height={size} unoptimized loading="eager" />;
}

export function BrandWordmark({ className }: { className?: string }) {
  return <span className={`${styles.wordmark} ${className ?? ""}`}>
    <Image className={styles.light} src="/images/brand/wordmark-light.png" alt="Домовед" width={2172} height={724} sizes="240px" unoptimized loading="eager" />
    <Image className={styles.dark} src="/images/brand/wordmark-dark.png" alt="Домовед" width={2171} height={724} sizes="240px" unoptimized loading="eager" />
  </span>;
}
