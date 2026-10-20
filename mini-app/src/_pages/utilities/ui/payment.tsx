"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { money, invoicePeriod } from "@/entities/utilities";
import { Icon } from "@/shared/ui/icon";
import { BrandWordmark } from "@/shared/ui/brand-mark";
import styles from "./utilities.module.css";
export function Payment({ amount, apartment, period, invoiceNumber, address, entrance, floor }: { amount:number; apartment:number; period:string; invoiceNumber:string; address:string; entrance:number; floor:number }) {
 const dialog=useRef<HTMLDialogElement>(null);
 const [method,setMethod]=useState<"sbp"|"card">("sbp");
 const [notice,setNotice]=useState("");
 return <>
  <button type="button" className={styles.primary} onClick={() => {setMethod("sbp");setNotice("");dialog.current?.showModal();}}>Оплатить квитанцию</button>
  <dialog ref={dialog} className={styles.dialog} aria-labelledby="payment-title">
   <div className={styles.handle} aria-hidden="true" /><BrandWordmark className={styles.paymentBrand} />
   <button type="button" className={styles.close} aria-label="Закрыть оплату" onClick={() => dialog.current?.close()}><Icon name="close" /></button>
   <h2 id="payment-title">Оплата квитанции</h2><p className={styles.paymentSubtitle}>{invoicePeriod(period)}</p><p className={styles.paymentInvoice}>Квитанция №{invoiceNumber}</p>
   <div className={styles.paymentAccount}><Icon name="building" size={32} /><div><strong>Квартира {apartment}</strong><p>{address}<br />Подъезд {entrance} · Этаж {floor}</p></div></div>
   <div className={styles.methods} role="group" aria-label="Способ оплаты">{([{value:"sbp",label:"СБП",description:"Быстрый платёж без ввода карты",icon:"send"},{value:"card",label:"Банковская карта",description:"Visa, Mastercard, Мир",icon:"card"}] as const).map(item => <button className={styles.method} type="button" key={item.value} aria-pressed={method===item.value} onClick={() => {setMethod(item.value);setNotice("");}}>{item.value === "sbp" ? <Image className={styles.sbpIcon} src="/images/payments/sbp.png" width={30} height={35} alt="" unoptimized /> : <Icon name={item.icon} size={30} />}<span><strong>{item.label}</strong><small>{item.description}</small></span><i aria-hidden="true">{method===item.value && <Icon name="check" size={20} />}</i></button>)}</div>
   <div className={styles.paymentTotal}><div><span>Сумма к оплате</span><strong>{money(amount)}</strong></div><div><span>Комиссия</span><span>0 ₽</span></div></div>
   <button type="button" className={styles.primary} onClick={() => setNotice("Платёжный сервис пока не подключён. Деньги не списываются.")}>Перейти к оплате</button>
   {notice && <p className={styles.feedback} role="status">{notice}</p>}
   <p className={styles.paymentFootnote}><Icon name="lock" size={14} />Демонстрационный режим · без списания</p>
  </dialog>
 </>;
}
