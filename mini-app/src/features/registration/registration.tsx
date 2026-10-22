"use client";
import { BrandWordmark } from "@/shared/ui/brand-mark";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "@/shared/api/context";
import { endpoints } from "@/shared/api/client";
import { record } from "@/shared/api/parse";
import { useRemote } from "@/shared/api/use-remote";
import { RequestState } from "@/shared/ui/navigation/request-state";
import { parseRegistration, type Registration } from "./model";
import { registrationTarget } from "./registration-target";
import styles from "./registration.module.css";

export function RegistrationScreen({ onComplete, onApproved, additional = false, embedded = additional, preferredHouseId }: { preferredHouseId?: string; onComplete: () => void; onApproved?: () => void; additional?: boolean; embedded?: boolean }) {
  const api = useApi();
  const complete = useRef(onComplete);
  useEffect(() => { complete.current = onComplete; }, [onComplete]);
  const load = useCallback(async (signal: AbortSignal) => parseRegistration(await api(endpoints.registrationState(preferredHouseId), { signal })), [api, preferredHouseId]);
  const state = useRemote(load);
  const latest = useRef({ status: state.data?.status, reload: state.reload });
  useEffect(() => { latest.current = { status: state.data?.status, reload: state.reload }; }, [state.data?.status, state.reload]);
  useEffect(() => {
    if (additional && !preferredHouseId) return;
    const controller = new AbortController();
    const check = async () => {
      if (document.hidden) return;
      try {
        const fresh = parseRegistration(await api(endpoints.registrationState(preferredHouseId), { signal: controller.signal }));
        if (controller.signal.aborted) return;
        if (fresh.complete) complete.current();
        else if (fresh.status !== latest.current.status) latest.current.reload();
      } catch {}
    };
    const timer = window.setInterval(() => void check(), 10000);
    window.addEventListener("focus", check);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", check); };
  }, [api, additional, preferredHouseId]);
  useEffect(() => { if ((!additional || !!preferredHouseId) && state.data?.complete) complete.current(); }, [state.data?.complete, additional, preferredHouseId]);
  return <div className={embedded ? styles.embedded : styles.screen}>
    {!embedded && <div className={styles.brand}><BrandWordmark /></div>}
    {!state.data ? <RequestState {...state} /> : (!additional || !!preferredHouseId) && state.data.complete ? <p role="status">Открываем ваш дом…</p> :
      <RegistrationForm key={`${preferredHouseId ?? "general"}:${state.data.status ?? "new"}`} preferredHouseId={preferredHouseId} initial={state.data} onComplete={onComplete} refresh={state.reload} additional={additional} onApproved={onApproved} />}
    {state.data && state.error && <p role="alert">{state.error}</p>}
  </div>;
}

function RegistrationForm({ initial, onComplete, refresh, additional, onApproved, preferredHouseId }: { preferredHouseId?: string; initial: Registration; onComplete: () => void; refresh: () => void; additional: boolean; onApproved?: () => void }) {
  const api = useApi();
  const [step, setStep] = useState(additional ? 2 : 0);
  const [name, setName] = useState(initial.name);
  const destination = registrationTarget(initial.companies, preferredHouseId);
  const [companyId, setCompany] = useState(destination?.companyId ?? 0);
  const [houseId, setHouse] = useState(destination?.houseId ?? 0);
  const [entranceNumber, setEntrance] = useState(0);
  const [apartment, setApartment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [approved, setApproved] = useState(false);
  const company = initial.companies.find(c => c.id === companyId);
  const house = company?.houses.find(h => h.id === houseId);
  const entrance = house?.entrances.find(e => e.number === entranceNumber);
  const pending = ((!additional || !!preferredHouseId) && initial.status === "pending") || (submitted && !approved);

  async function submit() {
    if (busy || !house || !entrance) return;
    setBusy(true); setError("");
    try {
      const result = record(await api(endpoints.registration, { body: {
        full_name: name.trim(), company_id: companyId, house_id: houseId, entrance: entrance.number, apartment_number: Number(apartment), additional: additional || !!preferredHouseId,
      } }));
      const accepted = result.application_status === "approved" || (!preferredHouseId && !additional && result.complete === true);
      setApproved(accepted); setSubmitted(true);
      if (accepted) { onApproved?.(); if (preferredHouseId) onComplete(); }
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось отправить заявку"); }
    finally { setBusy(false); }
  }

  return <section className={styles.card} aria-labelledby="registration-title">
    <span className={styles.eyebrow}>{pending || submitted ? "ВАША ЗАЯВКА" : additional ? "ЕЩЁ ОДНА КВАРТИРА" : `ЗНАКОМСТВО С ДОМОМ · ${step + 1} / 3`}</span>
    <h1 id="registration-title">{approved ? "Добро пожаловать домой!" : pending ? "Заявка передана в УК" : ["Ваш дом всегда на связи", "Как к вам обращаться?", "Где вы живёте?"][step]}</h1>
    {preferredHouseId && destination && <p className={styles.sourceAddress}>{destination.address}<small>Дом выбран по приглашению</small></p>}
    {initial.testMode && <p className={styles.notice}>Тестовый режим: все заявки принимаются автоматически.</p>}
    {pending ? <><p>После принятия заявки квартира появится в боте и мини-приложении. Повторно заполнять данные не нужно.</p><button className={styles.primary} onClick={preferredHouseId ? () => { refresh(); onComplete(); } : additional ? onComplete : refresh}>{additional && !preferredHouseId ? "Вернуться к квартирам" : "Проверить статус"}</button></> : approved ?
      <><p>Квартира привязана. Теперь можно сообщать о проблемах и следить за жизнью дома.</p><button className={styles.primary} onClick={onComplete}>{preferredHouseId ? "Продолжить" : additional ? "Готово — к моим квартирам" : "Открыть мой дом"}</button></> : <>
      {step === 0 && <>
        <p>Домовед помогает сообщать о проблемах, следить за их решением и общаться с управляющей компанией.</p>
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
        <select id="registration-company" value={companyId} disabled={busy || !!preferredHouseId} onChange={event => { setCompany(Number(event.target.value)); setHouse(0); setEntrance(0); setApartment(""); setError(""); }}>
          <option value={0} disabled>Выберите управляющую компанию</option>
          {initial.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {!initial.companies.length ? <p>Зарегистрированных УК пока нет. Обратитесь в свою УК или <button type="button" onClick={refresh}>проверьте позже</button>.</p> : <>
          <label htmlFor="registration-house">Адрес проживания</label>
          <select id="registration-house" required value={houseId || ""} disabled={busy || !!preferredHouseId} onChange={event => { setHouse(Number(event.target.value)); setEntrance(0); setApartment(""); setError(""); }}>
            <option value="" disabled>Выберите дом</option>
            {company?.houses.map(h => <option key={h.id} value={h.id}>{h.address}</option>)}
          </select>
          {house && <><p className={styles.hint}>{house.floors} этажей</p>
            {house.entrances.length ? <>
              <label htmlFor="registration-entrance">Подъезд</label>
              <select id="registration-entrance" required value={entranceNumber || ""} disabled={busy} onChange={event => { setEntrance(Number(event.target.value)); setApartment(""); setError(""); }}>
                <option value="" disabled>Выберите подъезд</option>
                {house.entrances.map(e => <option key={e.number} value={e.number}>Подъезд {e.number}</option>)}
              </select>
              {entrance && <>
                <p className={styles.hint}>Подъезд {entrance.number} · квартиры {entrance.firstApartment}–{entrance.lastApartment}</p>
                <label htmlFor="registration-apartment">Номер квартиры</label><input id="registration-apartment" type="number" inputMode="numeric" min={entrance.firstApartment} max={entrance.lastApartment} step={1} value={apartment} onChange={event => { setApartment(event.target.value); setError(""); }} disabled={busy} required />
              </>}
            </> : <p role="status">В этом доме пока нет квартир для привязки. Обратитесь в свою УК.</p>}
          </>}
          <p className={styles.hint}>Заявка от: {name}</p><p className={styles.hint}>Одну квартиру могут добавить несколько членов семьи.</p>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <button className={styles.primary} disabled={busy || !house || !entrance || !apartment}>{busy ? "Отправляем заявку…" : "Отправить заявку"}</button>
        </>}
        <button className={styles.secondary} type="button" disabled={busy} onClick={() => setStep(1)}>Изменить ФИО</button>
      </form>}
    </>}
  </section>;
}
