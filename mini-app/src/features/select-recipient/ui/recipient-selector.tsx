"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { conversationHref } from "@/shared/api/conversation-route";

import { useHouseSelection, floorApartments, findApartment, FloorControls } from "@/entities/house";
import { messageThreads, useMessages } from "@/entities/message";
import { Icon } from "@/shared/ui/icon";
import styles from "./recipient-selector.module.css";
import { ChatScreen } from "@/shared/ui/chat-screen";
import chatStyles from "@/shared/ui/chat-screen.module.css";
import { RequestState } from "@/shared/ui/navigation/request-state";

export function RecipientSelector({ openSelected = false }: { openSelected?: boolean }) {
  const { house, selected, select } = useHouseSelection();
  const { messages, drafts, photoDrafts, loading, error, reload } = useMessages();
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (openSelected && selected.zone === "apartment" && selected.apartment !== house.residentApartment) router.replace(conversationHref(selected.apartment, house.residentApartmentId));
  }, [openSelected, selected, house.residentApartment, house.residentApartmentId, router]);
  const [query, setQuery] = useState("");
  const [picker, setPicker] = useState({ entrance: selected.entrance, floor: selected.floor, apartment: 0 });
  const threads = messageThreads(messages).filter(message => message.apartment !== house.residentApartment);
  const draftOnly = [...new Set([...Object.keys(drafts), ...Object.keys(photoDrafts)])].map(Number).filter(apartment => (drafts[apartment]?.trim() || photoDrafts[apartment]?.length) && !threads.some(thread => thread.apartment === apartment));
  const conversations = [...draftOnly.map(apartment => ({ apartment, text: "", direction: "outgoing" as const, createdAt: "" })), ...threads].filter(thread => `Квартира ${thread.apartment} ${thread.text}`.toLowerCase().includes(query.toLowerCase().trim()));
  const apartments = floorApartments(house, picker.entrance, picker.floor);
  function choose(apartment: number) {
    const place = findApartment(house, apartment);
    if (apartment === house.residentApartment) return;
    if (place) select(place);
    router.push(conversationHref(apartment, house.residentApartmentId));
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
    <ChatScreen title="Сообщения" subtitle={house.address} backHref="/more" backLabel="Назад: Ещё" inbox action={<button type="button" data-tour="new-message" className={chatStyles.newChat} aria-label="Новая переписка" title="Написать соседу" onClick={openPicker}><Icon name="plus" size={24} /></button>}>
      <div data-tour="message-panel" className={styles.inbox}>
        <RequestState loading={loading} error={error} reload={reload} />
        <label className={styles.field}>Поиск по перепискам<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Квартира или сообщение" /></label>
        <ul className={styles.threadList} aria-label="Переписки с соседями">{conversations.map(thread => {
          const exists = !!findApartment(house, thread.apartment);
          return <li key={thread.apartment}><button className={styles.threadButton} onClick={() => choose(thread.apartment)}>
            <span className={styles.avatar}>{thread.apartment}</span><span className={styles.threadText}><strong>Квартира {thread.apartment}</strong><small>{(drafts[thread.apartment]?.trim() || photoDrafts[thread.apartment]?.length) ? `Черновик: ${drafts[thread.apartment]?.trim() || `Фото · ${photoDrafts[thread.apartment].length}`}` : `${thread.direction === "outgoing" ? "Вы: " : "Сосед: "}${thread.text}`}</small>{!exists && <small>Нет в текущей структуре</small>}</span>
            {thread.createdAt && <time dateTime={thread.createdAt}>{new Date(thread.createdAt).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit" })}</time>}
          </button></li>;
        })}</ul>
        {!conversations.length && <div className={styles.empty}><p>{query ? "Переписки не найдены" : "Переписок пока нет"}</p>{query ? <button className={styles.chip} onClick={() => setQuery("")}>Сбросить поиск</button> : <button className={styles.chip} onClick={openPicker}>Написать соседу</button>}</div>}

      </div>
    </ChatScreen>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="recipient-heading"><div className={styles.dialogHeading}><h2 id="recipient-heading">Выберите квартиру</h2><button className={styles.close} type="button" aria-label="Закрыть выбор квартиры" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
      <FloorControls house={house} entrance={picker.entrance} floor={picker.floor} onChange={changeFloor} />
      <label className={styles.field}>Квартира<select value={picker.apartment} onChange={event => setPicker({ ...picker, apartment: Number(event.target.value) })}>{picker.apartment === 0 && <option value={0}>Нет других квартир на этаже</option>}{apartments.map(apartment => <option key={apartment} value={apartment} disabled={apartment === house.residentApartment}>Квартира {apartment}{apartment === house.residentApartment ? " · ваша квартира" : ""}</option>)}</select></label>
      <button type="button" className={styles.send} disabled={!picker.apartment || picker.apartment === house.residentApartment} onClick={() => { choose(picker.apartment); dialog.current?.close(); }}>Открыть разговор</button>
    </dialog>
  </>;
}
