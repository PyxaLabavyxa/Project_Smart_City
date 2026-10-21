"use client";

import { useCallback, useState } from "react";
import { useApi } from "@/shared/api/context";
import { endpoints } from "@/shared/api/client";
import { useRemote } from "@/shared/api/use-remote";
import { BrandWordmark } from "@/shared/ui/brand-mark";
import { Icon } from "@/shared/ui/icon";
import { RequestState } from "@/shared/ui/navigation/request-state";
import { Zhorik } from "@/shared/ui/zhorik";
import { parseRegistration } from "./model";
import { registrationTarget } from "./registration-target";
import { RegistrationScreen } from "./registration";
import styles from "./chat-house-access.module.css";

export function ChatHouseAccess({ houseId, hasApartments, onComplete, onHome }: {
  houseId: string; hasApartments: boolean; onComplete: () => void; onHome: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const api = useApi();
  const load = useCallback(async (signal: AbortSignal) => parseRegistration(await api(endpoints.registrationState(houseId), { signal })), [api, houseId]);
  const state = useRemote(load);
  const target = state.data && registrationTarget(state.data.companies, houseId);
  return <main className={styles.screen}>
    <header className={styles.header}>
      {adding && <button type="button" className={styles.back} aria-label="Назад" onClick={() => setAdding(false)}><Icon name="back" /></button>}
      <BrandWordmark className={styles.brand} />
    </header>
    {adding && target ? <div className={styles.registration}>
      <RegistrationScreen embedded additional={hasApartments} preferredHouseId={houseId} onComplete={onComplete} />
    </div> : <section className={styles.content} aria-labelledby="chat-house-title">
      <Zhorik pose="open" className={styles.mascot} />
      <h1 id="chat-house-title">Добро пожаловать в ваш дом</h1>
      {!state.data ? <RequestState {...state} /> : target ? <>
        <p className={styles.address}><Icon name="pin" size={20} />{target.address}</p>
        <p>Добавьте квартиру в этом доме, чтобы сообщать о проблемах, читать объявления УК и общаться с соседями. Адрес уже подставлен в заявку.</p>
      </> : <p role="alert">Этот дом больше недоступен для регистрации. Вернитесь на главную и выберите свой адрес.</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={!target} onClick={() => setAdding(true)}><Icon name="plus" size={20} />Добавить квартиру</button>
        <button type="button" className={styles.secondary} onClick={onHome}>На главную Домоведа</button>
      </div>
    </section>}
  </main>;
}
