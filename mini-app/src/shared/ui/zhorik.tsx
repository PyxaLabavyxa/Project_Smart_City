import Image from "next/image";
import styles from "./zhorik.module.css";
import { guideArtwork } from "./guide-assets";

export type ZhorikPose = "point" | "rest" | "peek" | "open" | "wave" | "hanging";

export function Zhorik({ pose = "open", className, mirrored = false }: {
  pose?: ZhorikPose; className?: string; mirrored?: boolean;
}) {
  return <span className={`${styles.mascot} ${className ?? ""}`} data-pose={pose} data-mirrored={mirrored || undefined} aria-hidden="true">
    <Image src={guideArtwork[pose]} alt="" width={1448} height={1086} unoptimized loading="eager" />
  </span>;
}
