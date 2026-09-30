import Image from "next/image";
import styles from "./house-art.module.css";

export function HouseArt({ className, withGnome = false }: { className?: string; withGnome?: boolean }) {
  return <div className={`${styles.art} ${className ?? ""}`} data-house-art aria-hidden="true">
    <Image className={styles.day} src={`/images/domoved/${withGnome ? "house-scene" : "house-clean"}.webp`} alt="" fill sizes="(max-width:760px) 360px, 600px" unoptimized loading="eager" />
    <Image className={styles.night} src="/images/domoved/house-night.webp" alt="" fill sizes="(max-width:760px) 360px, 600px" unoptimized loading="eager" />
  </div>;
}
