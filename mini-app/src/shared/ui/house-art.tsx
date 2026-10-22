import styles from "./house-art.module.css";
import { artworkStyle, homeArtwork } from "./artwork-assets";

export function HouseArt({ className }: { className?: string }) {
  return <div className={`${styles.art} ${className ?? ""}`} style={artworkStyle(homeArtwork)} data-house-art aria-hidden="true" />;
}
