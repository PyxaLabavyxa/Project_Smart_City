"use client";

import { useState } from "react";
import { BrandWordmark } from "@/shared/ui/brand-mark";
import { Icon } from "@/shared/ui/icon";
import { Zhorik } from "@/shared/ui/zhorik";
import { RegistrationScreen } from "./registration";
import styles from "./chat-house-access.module.css";

export function ChatHouseAccess({ hasApartments, onComplete, onHome }: {
  hasApartments: boolean; onComplete: () => void; onHome: () => void;
}) {
  const [adding, setAdding] = useState(false);
  return <main className={styles.screen}>
    <header className={styles.header}>
      {adding && <button type="button" className={styles.back} aria-label="Назад" onClick={() => setAdding(false)}><Icon name="back" /></button>}
      <BrandWordmark className={styles.brand} />
    </header>
    {adding ? <div className={styles.registration}>
      <RegistrationScreen embedded additional={hasApartments} onComplete={onComplete} />
    </div> : <section className={styles.content} aria-labelledby="chat-house-title">
      <Zhorik pose="open" className={styles.mascot} />
      <h1 id="chat-house-title">Дом пока не привязан</h1>
      <p>Вы перешли из домового чата. Добавьте квартиру в этом доме, чтобы сообщать о проблемах и видеть обращения соседей.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => setAdding(true)}><Icon name="plus" size={20} />Добавить квартиру</button>
        <button type="button" className={styles.secondary} onClick={onHome}>На главную Домоведа</button>
      </div>
    </section>}
  </main>;
}
