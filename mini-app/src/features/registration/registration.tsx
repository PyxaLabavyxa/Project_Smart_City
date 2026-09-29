"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "@/shared/api/context";
import { endpoints } from "@/shared/api/client";
import { record } from "@/shared/api/parse";
import { useRemote } from "@/shared/api/use-remote";
import { RequestState } from "@/shared/ui/navigation/request-state";
import { parseRegistration, type Registration } from "./model";
import styles from "./registration.module.css";

export function RegistrationScreen({ onComplete, onApproved, additional = false }: { onComplete: () => void; onApproved?: () => void; additional?: boolean }) {
  const api = useApi();
  const complete = useRef(onComplete);
  useEffect(() => { complete.current = onComplete; }, [onComplete]);
  const load = useCallback(async (signal: AbortSignal) => parseRegistration(await api(endpoints.registration, { signal })), [api]);
  const state = useRemote(load);
  // A completed bot flow unlocks an already-open mini-app without losing an unfinished form.
  useEffect(() => {
    if (additional) return;
    const controller = new AbortController();
    const check = async () => {
      if (document.hidden) return;
      try {
        const fresh = parseRegistration(await api(endpoints.registration, { signal: controller.signal }));
        if (fresh.complete && !controller.signal.aborted) complete.current();
      } catch { /* Explicit refresh below exposes errors and provides a retry path. */ }
    };
    const timer = window.setInterval(() => void check(), 10000);
    window.addEventListener("focus", check);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", check); };
  }, [api, additional]);
  useEffect(() => { if (!additional && state.data?.complete) complete.current(); }, [state.data?.complete, additional]);
  return <div className={additional ? styles.embedded : styles.screen}>
    {!additional && <div className={styles.brand}><span>д.</span> домпульс</div>}
    {!state.data ? <RequestState {...state} /> : !additional && state.data.complete ? <p role="status">Открываем ваш дом…</p> :
      <RegistrationForm initial={state.data} onComplete={onComplete} refresh={state.reload} additional={additional} onApproved={onApproved} />}
    {state.data && state.error && <p role="alert">{state.error}</p>}
  </div>;
}

function RegistrationForm({ initial, onComplete, refresh, additional, onApproved }: { initial: Registration; onComplete: () => void; refresh: () => void; additional: boolean; onApproved?: () => void }) {
  const api = useApi();
  const [step, setStep] = useState(additional ? 2 : 0);
  const [name, setName] = useState(initial.name);
  const [companyId, setCompany] = useState(initial.companies[0]?.id ?? 0);
  const [houseId, setHouse] = useState(0);
  const [apartment, setApartment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [approved, setApproved] = useState(false);
  const company = initial.companies.find(c => c.id === companyId);
  const house = company?.houses.find(h => h.id === houseId);
  const pending = (!additional && initial.status === "pending") || (submitted && !approved);

  async function submit() {
    if (busy || !house) return;
    setBusy(true); setError("");
    try {
      const result = record(await api(endpoints.registration, { body: {
        full_name: name.trim(), company_id: companyId, house_id: houseId, apartment_number: Number(apartment), additional,
      } }));
      const accepted = result.application_status === "approved" || (!additional && result.complete === true);
      setApproved(accepted); setSubmitted(true);
      if (accepted) onApproved?.();
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось отправить заявку"); }
    finally { setBusy(false); }
  }

  return <section className={styles.card} aria-labelledby="registration-title">
    <span className={styles.eyebrow}>{pending || submitted ? "ВАША ЗАЯВКА" : additional ? "ЕЩЁ ОДНА КВАРТИРА" : `ЗНАКОМСТВО С ДОМОМ · ${step + 1} / 3`}</span>
    <h1 id="registration-title">{approved ? "Добро пожаловать домой!" : pending ? "Заявка передана в УК" : ["Ваш дом всегда на связи", "Как к вам обращаться?", "Где вы живёте?"][step]}</h1>
    {initial.testMode && <p className={styles.notice}>Тестовый режим: все заявки принимаются автоматически.</p>}
    {pending ? <><p>После принятия заявки квартира появится в боте и мини-приложении. Повторно заполнять данные не нужно.</p><button className={styles.primary} onClick={additional ? onComplete : refresh}>{additional ? "Вернуться к квартирам" : "Проверить статус"}</button></> : approved ?
      <><p>Квартира привязана. Теперь можно сообщать о проблемах и следить за жизнью дома.</p><button className={styles.primary} onClick={onComplete}>{additional ? "Готово — к моим квартирам" : "Открыть мой дом"}</button></> : <>
      {step === 0 && <>
        <p>ДомПульс помогает сообщать о проблемах, следить за их решением и общаться с управляющей компанией.</p>
        <div className={styles.empty}><strong>Вам пока не назначены квартиры</strong><p>Для назначения обратитесь в свою УК или оставьте заявку в зарегистрированную управляющую компанию.</p></div>
        {initial.status === "rejected" && <p role="status">Предыдущая заявка отклонена. Проверьте данные и отправьте новую.</p>}
        <button className={styles.primary} onClick={() => setStep(1)}>Оставить заявку в УК <span aria-hidden="true">↗</span></button>
        <button className={styles.secondary} onClick={refresh}>УК уже назначила квартиру — проверить</button>
      </>}
      {step === 1 && <form onSubmit={event => { event.preventDefault(); setName(name.trim()); setStep(2); }}>
        <label htmlFor="resident-name">Фамилия, имя и отчество</label>
        <input id="resident-name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={200} required />
        <p className={styles.hint}>Подставили имя из вашего профиля. Проверьте и при необходимости исправьте — его увидит УК.</p>
        <button className={styles.primary} disabled={name.trim().length < 2}>Продолжить</button>
        <button className={styles.secondary} type="button" onClick={() => setStep(additional ? 2 : 0)}>Назад</button>
      </form>}
      {step === 2 && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label htmlFor="registration-company">Управляющая компания</label>
        <select id="registration-company" value={companyId} disabled={busy} onChange={event => { setCompany(Number(event.target.value)); setHouse(0); setApartment(""); }}>
          {initial.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {!initial.companies.length ? <p>Зарегистрированных УК пока нет. Обратитесь в свою УК или <button type="button" onClick={refresh}>проверьте позже</button>.</p> : <>
          <label htmlFor="registration-house">Адрес проживания</label>
          <select id="registration-house" required value={houseId || ""} disabled={busy} onChange={event => { setHouse(Number(event.target.value)); setApartment(""); }}>
            <option value="" disabled>Выберите дом</option>
            {company?.houses.map(h => <option key={h.id} value={h.id}>{h.address}</option>)}
          </select>
          {house && <><p className={styles.hint}>{house.floors} этажей · квартиры 1–{house.apartmentsCount}</p>
            <label htmlFor="registration-apartment">Номер квартиры</label><input id="registration-apartment" type="number" inputMode="numeric" min={1} max={house.apartmentsCount} step={1} value={apartment} onChange={event => setApartment(event.target.value)} disabled={busy} required />
          </>}
          <p className={styles.hint}>Заявка от: {name}</p><p className={styles.hint}>Одну квартиру могут добавить несколько членов семьи.</p>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <button className={styles.primary} disabled={busy || !house || !apartment}>{busy ? "Отправляем заявку…" : "Отправить заявку"}</button>
        </>}
        <button className={styles.secondary} type="button" disabled={busy} onClick={() => setStep(1)}>Изменить ФИО</button>
      </form>}
    </>}
  </section>;
}
