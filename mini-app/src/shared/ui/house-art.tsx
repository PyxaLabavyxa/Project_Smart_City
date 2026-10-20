import Image from "next/image";
import styles from "./house-art.module.css";

export function HouseArt({ className }: { className?: string }) {
  return <div className={`${styles.art} ${className ?? ""}`} data-house-art aria-hidden="true">
    <Image className={styles.day} src="/images/zhorik/home-house.png" alt="" fill sizes="250px" unoptimized loading="eager" />
    <Image className={styles.night} src="/images/zhorik/home-house-night-v2.png" alt="" fill sizes="250px" unoptimized loading="eager" />
  </div>;
}
