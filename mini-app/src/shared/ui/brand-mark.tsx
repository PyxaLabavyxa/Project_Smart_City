import Image from "next/image";
import styles from "./brand-mark.module.css";
import { appIcon, artworkStyle, wordmarkArtwork } from "./artwork-assets";

export function BrandMark({ size = 46, className }: { size?: number; className?: string }) {
  return <Image className={className} src={appIcon} alt="" width={size} height={size} unoptimized loading="eager" />;
}

export function BrandWordmark({ className }: { className?: string }) {
  return <span className={`${styles.wordmark} ${className ?? ""}`} style={artworkStyle(wordmarkArtwork)} role="img" aria-label="Домовед" />;
}
