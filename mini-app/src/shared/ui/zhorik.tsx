import Image from "next/image";
import styles from "./zhorik.module.css";

export type ZhorikPose = "point" | "rest" | "peek" | "open" | "wave" | "hanging";

export function Zhorik({ pose = "open", className, mirrored = false }: {
  pose?: ZhorikPose; className?: string; mirrored?: boolean;
}) {
  return <span className={`${styles.mascot} ${className ?? ""}`} data-pose={pose} data-mirrored={mirrored || undefined} aria-hidden="true">
    <Image src={`/images/zhorik/${pose}.png`} alt="" width={1448} height={1086} unoptimized loading="eager" />
  </span>;
}
