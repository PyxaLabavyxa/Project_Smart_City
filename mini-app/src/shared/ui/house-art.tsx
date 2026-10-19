import Image from "next/image";
import styles from "./house-art.module.css";

export function HouseArt({ className }: { className?: string }) {
  return <div className={`${styles.art} ${className ?? ""}`} data-house-art aria-hidden="true">
    <Image src="/images/zhorik/home-house.png" alt="" fill sizes="250px" unoptimized loading="eager" />
  </div>;
}
