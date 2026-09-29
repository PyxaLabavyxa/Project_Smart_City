"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { money } from "@/entities/utilities";
import { Icon } from "@/shared/ui/icon";
import styles from "./utilities.module.css";

function CardPlaceholder() {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (number.replace(/\s/g, "") !== "4242424242424242" || expiry !== "12/30" || code !== "123") {
      setNotice("Используйте указанные реквизиты."); return;
    }
    setNumber(""); setExpiry(""); setCode("");
    setNotice("Оплата не подключена. Списания не было, счёт остаётся неоплаченным.");
  }
  return <form onSubmit={submit} autoComplete="off" className={styles.cardForm}>
    <p className={styles.notice}>Не вводите данные настоящей карты. Доступные реквизиты: 4242 4242 4242 4242, срок 12/30, код 123.</p>
    <label className={styles.field}>Номер карты<input inputMode="numeric" autoComplete="off" value={number} maxLength={19} placeholder="4242 4242 4242 4242" onChange={event => setNumber(event.target.value.replace(/\D/g, "").slice(0,16).replace(/(.{4})/g, "$1 ").trim())} /></label>
    <div className={styles.cardFields}>
      <label className={styles.field}>Срок действия<input inputMode="numeric" autoComplete="off" placeholder="12/30" value={expiry} maxLength={5} onChange={event => { const digits = event.target.value.replace(/\D/g, "").slice(0,4); setExpiry(digits.length > 2 ? `${digits.slice(0,2)}/${digits.slice(2)}` : digits); }} /></label>
      <label className={styles.field}>Код безопасности<input type="password" inputMode="numeric" autoComplete="off" placeholder="123" value={code} maxLength={3} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} /></label>
    </div>
    <button className={styles.primary}>Оплатить</button>
    <p role="status" className={styles.notice}>{notice || "Форма не отправляет и не сохраняет реквизиты. Платёжный сервис не подключён."}</p>
  </form>;
}

export function Payment({ amount, apartment, period }: { amount: number; apartment: number; period: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closing = useRef<Animation | null>(null);
  const [method, setMethod] = useState<"qr" | "card">("qr");
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => () => { closing.current?.cancel(); closing.current = null; }, []);
  function closePayment() {
    const element = dialog.current;
    if (!element?.open || closing.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !element.animate) { element.close(); return; }
    const appearance = getComputedStyle(element);
    const from = { opacity: appearance.opacity, transform: appearance.transform };
    element.style.setProperty("--backdrop-opacity", getComputedStyle(element, "::backdrop").opacity);
    element.dataset.closing = "true";
    const animation = element.animate(
      [from, { opacity: 0, transform: "translateY(12px) scale(.97)" }],
      { duration: 180, easing: "ease-in", fill: "forwards" },
    );
    closing.current = animation;
    void animation.finished.then(() => {
      if (closing.current !== animation) return;
      element.close();
      animation.cancel();
      closing.current = null;
      delete element.dataset.closing;
    }, () => {   });
  }
  return <>
    <button className={styles.primary} onClick={() => { setOpen(true); setMethod("qr"); setNotice(""); dialog.current?.showModal(); }}>Выбрать способ оплаты <Icon name="arrow" size={16} /></button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="payment-title" onClose={() => setOpen(false)} onCancel={event => { event.preventDefault(); closePayment(); }}>
      <div className={styles.row}><h2 id="payment-title">Оплата ЖКХ</h2><button className={styles.close} aria-label="Закрыть оплату" onClick={closePayment}><Icon name="close" /></button></div>
      {open && <><p className={styles.muted}>Квартира {apartment} · {period.toLowerCase()}</p><p className={styles.paymentAmount}>{money(amount)}</p>
        <div className={styles.tabs} role="group" aria-label="Способ оплаты"><button aria-pressed={method === "qr"} onClick={() => { setMethod("qr"); setNotice(""); }}>По QR-коду</button><button aria-pressed={method === "card"} onClick={() => setMethod("card")}>Банковской картой</button></div>
        <div key={method} className={styles.methodContent}>{method === "qr" ? <div className={styles.qr}><Image src="/images/payment-placeholder.svg" width={210} height={210} alt="QR-код без платёжных реквизитов" unoptimized /><h3>QR-код</h3><p className={styles.muted}>Код содержит только текст. Банковских реквизитов и ссылки на оплату в нём нет.</p><button className={styles.secondary} onClick={() => setNotice("Проверка оплаты недоступна: платёжный сервис ещё не подключён.")}>Проверить оплату</button><p role="status" className={styles.notice}>{notice || "Оплата пока недоступна. Деньги не спишутся."}</p></div> : <CardPlaceholder />}</div>
      </>}
    </dialog>
  </>;
}
