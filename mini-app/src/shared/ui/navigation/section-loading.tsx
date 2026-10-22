import Image from "next/image";
import { sectionLoadingArtwork } from "../artwork-assets";
import { LoadingProgress } from "../loading-progress";
import styles from "./section-loading.module.css";

export function SectionLoading({ label = "Загружаем раздел…" }: { label?: string }) {
  return <div className={styles.loading} role="status" aria-busy="true">
    <Image src={sectionLoadingArtwork} alt="" width={144} height={108} unoptimized loading="eager" />
    <p>{label}</p>
    <div className={styles.progress} aria-hidden="true"><LoadingProgress /></div>
  </div>;
}
