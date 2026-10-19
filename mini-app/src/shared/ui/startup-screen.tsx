import Image from "next/image";
import type { ReactNode } from "react";
import { BrandWordmark } from "./brand-mark";
import { LoadingProgress } from "./loading-progress";
import styles from "./startup-screen.module.css";

export function StartupScreen({ percent, status = "Подключаемся к вашему дому…", error, actions, complete }: {
  percent?: number; status?: string; error?: string; actions?: ReactNode; complete?: boolean;
}) {
  return <section className={styles.screen} data-complete={complete || undefined} aria-labelledby="preparation-title">
    <div className={styles.canvas}>
      <div className={styles.scene} aria-hidden="true">
        <Image className={styles.day} src="/images/zhorik/loading-day.png" alt="" fill unoptimized loading="eager" sizes="480px" />
        <Image className={styles.night} src="/images/zhorik/loading-night.png" alt="" fill unoptimized loading="eager" sizes="480px" />
      </div>
      <div className={styles.content}>
        <div className={styles.mark}><BrandWordmark /></div>
        <h2 id="preparation-title">Открываем ваш дом</h2>
        <p className={styles.description}>Жорик уже в пути.<br />Ещё немного — и мы дома.</p>
        <LoadingProgress value={percent} label="Подготовка приложения" />
        <span role="status" className={styles.status}>{error ? "Не удалось загрузить данные" : status}</span>
        {(error || actions) && <div className={styles.actions}>{error && <p role="alert">{error}</p>}{actions}</div>}
      </div>
    </div>
  </section>;
}
