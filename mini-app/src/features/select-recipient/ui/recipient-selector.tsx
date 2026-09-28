"use client";
import { useRef, useState } from "react";

import { useHouseSelection, floorApartments, findApartment, FloorControls, PlaceLink } from "@/entities/house";
import { messageThreads, useMessages } from "@/entities/message";
import { Icon } from "@/shared/ui/icon";
import { Conversation } from "./conversation";
import styles from "./recipient-selector.module.css";
import { RequestState } from "@/shared/ui/navigation/request-state";

export function RecipientSelector({ openSelected = false }: { openSelected?: boolean }) {
  const { house, selected, select } = useHouseSelection();
  const { messages, drafts, loading, error, reload } = useMessages();
  const dialog = useRef<HTMLDialogElement>(null);
  const threadHeading = useRef<HTMLHeadingElement>(null);
  const inboxHeading = useRef<HTMLHeadingElement>(null);
  const [active, setActive] = useState<number | null>(openSelected && selected.zone === "apartment" && selected.apartment !== house.residentApartment ? selected.apartment : null);
  const [query, setQuery] = useState("");
  const [picker, setPicker] = useState({ entrance: selected.entrance, floor: selected.floor, apartment: 0 });
  const recipient = active === null ? undefined : findApartment(house, active);
  const threads = messageThreads(messages).filter(message => message.apartment !== house.residentApartment);
  const draftOnly = Object.keys(drafts).map(Number).filter(apartment => drafts[apartment]?.trim() && !threads.some(thread => thread.apartment === apartment));
  const conversations = [...draftOnly.map(apartment => ({ apartment, text: "", direction: "outgoing" as const, createdAt: "" })), ...threads].filter(thread => `Квартира ${thread.apartment} ${thread.text}`.toLowerCase().includes(query.toLowerCase().trim()));
  const apartments = floorApartments(house, picker.entrance, picker.floor);
  function choose(apartment: number) {
    const place = findApartment(house, apartment);
    if (place && apartment !== house.residentApartment) {
      select(place); setActive(apartment);
      requestAnimationFrame(() => threadHeading.current?.focus());
    }
  }
  function changeFloor(entrance: number, floor: number) {
    const first = floorApartments(house, entrance, floor).find(number => number !== house.residentApartment);
    setPicker({ entrance, floor, apartment: first ?? 0 });
  }
  function openPicker() {
    changeFloor(selected.entrance, selected.floor);
    dialog.current?.showModal();
  }
  return <>
    <RequestState loading={loading} error={error} reload={reload} />
    <button type="button" className={styles.chip} disabled={loading} onClick={reload}>Обновить сообщения</button>
    <div className={styles.chatLayout} data-open={active !== null}>
      <section className={styles.inbox} aria-label="Список переписок">
        <div className={styles.inboxHeading}><h2 ref={inboxHeading} tabIndex={-1}>Переписки</h2><button className={styles.chip} onClick={openPicker}>Написать</button></div>
        <label className={styles.field}>Поиск по перепискам<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Квартира или сообщение" /></label>
        <ul className={styles.threadList}>{conversations.map(thread => {
          const exists = !!findApartment(house, thread.apartment);
          return <li key={thread.apartment}><button className={styles.threadButton} aria-pressed={active === thread.apartment} onClick={() => { if (exists) choose(thread.apartment); else setActive(thread.apartment); }}>
            <span className={styles.avatar}>{thread.apartment}</span><span className={styles.threadText}><strong>Квартира {thread.apartment}</strong><small>{drafts[thread.apartment]?.trim() ? `Черновик: ${drafts[thread.apartment]}` : `${thread.direction === "outgoing" ? "Вы: " : "Сосед: "}${thread.text}`}</small>{!exists && <small>Нет в текущей структуре</small>}</span>
            {thread.createdAt && <time dateTime={thread.createdAt}>{new Date(thread.createdAt).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit" })}</time>}
          </button></li>;
        })}</ul>
        {!conversations.length && <div className={styles.empty}><p>{query ? "Переписки не найдены" : "Переписок пока нет"}</p>{query ? <button className={styles.chip} onClick={() => setQuery("")}>Сбросить поиск</button> : <button className={styles.chip} onClick={openPicker}>Написать соседу</button>}</div>}

      </section>
      <section className={styles.chatThread} aria-label="Открытая переписка">
        {active !== null ? <>
          <button className={styles.backToList} onClick={() => { setActive(null); requestAnimationFrame(() => inboxHeading.current?.focus()); }}>← Все переписки</button>
          <div className={styles.recipient}><span className={styles.avatar}>{active}</span><div><h2 ref={threadHeading} tabIndex={-1}>Квартира {active}</h2><p>{recipient ? `Подъезд ${recipient.entrance} · ${recipient.floor} этаж` : "Нет в текущей структуре дома"}</p></div>{recipient && <PlaceLink place={recipient} className={styles.place}>На плане <Icon name="plan" size={17} /></PlaceLink>}</div>
          <p className={styles.privacy}><Icon name="lock" size={16} />Автор указан по квартире. Телефоны и личные контакты скрыты.</p>
          {recipient?.zone === "apartment" ? <Conversation key={active} place={recipient} /> : <><p>Квартира удалена из структуры. Отправка недоступна.</p><ol className={styles.history}>{messages.filter(message => message.apartment === active).map(message => <li key={message.id} className={message.direction === "outgoing" ? styles.outgoing : styles.incoming}><small>{message.direction === "outgoing" ? "Вы" : `Квартира ${active}`}</small><p>{message.text}</p><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}</time></li>)}</ol></>}
        </> : <div className={styles.startChat}><Icon name="messages" size={40} /><h2>Сообщения соседям</h2><p>Откройте переписку слева или выберите квартиру, чтобы начать разговор.</p><button className={styles.send} onClick={openPicker}>Написать соседу</button></div>}
      </section>
    </div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="recipient-heading"><div className={styles.dialogHeading}><h2 id="recipient-heading">Выберите квартиру</h2><button className={styles.close} type="button" aria-label="Закрыть выбор квартиры" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
      <FloorControls house={house} entrance={picker.entrance} floor={picker.floor} onChange={changeFloor} />
      <label className={styles.field}>Квартира<select value={picker.apartment} onChange={event => setPicker({ ...picker, apartment: Number(event.target.value) })}>{picker.apartment === 0 && <option value={0}>Нет других квартир на этаже</option>}{apartments.map(apartment => <option key={apartment} value={apartment} disabled={apartment === house.residentApartment}>Квартира {apartment}{apartment === house.residentApartment ? " · ваша квартира" : ""}</option>)}</select></label>
      <button type="button" className={styles.send} disabled={!picker.apartment || picker.apartment === house.residentApartment} onClick={() => { choose(picker.apartment); dialog.current?.close(); }}>Открыть разговор</button>
    </dialog>
  </>;
}
