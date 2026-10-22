"use client";
import { useCallback, useState } from "react";
import { useHouseSelection } from "@/entities/house";
import { useApi } from "@/shared/api/context";
import { useRemote } from "@/shared/api/use-remote";
import { RequestState } from "@/shared/ui/navigation/request-state";
import { getManagementContacts } from "@/entities/management-company/model/api";
import { contactHref, contactInformation } from "@/entities/management-company/model/contacts";
import { Icon } from "@/shared/ui/icon";
import styles from "./more-page.module.css";
export function ManagementContacts({ houseId }: { houseId:string }) {
 const { house }=useHouseSelection(); const api=useApi();const [feedback,setFeedback]=useState("");
 const load=useCallback((signal:AbortSignal)=>getManagementContacts(api,houseId,signal),[api,houseId]);
 const state=useRemote(load);
 const {dispatcher,email,website,office,emergency,hours,reception}=contactInformation(state.data?.items ?? []);
 return <section className={styles.contacts} aria-label="Контакты УК"><RequestState {...state} />{!state.loading && !state.error && state.data && <>
  <div className={styles.companyCard}><span><Icon name="building" size={42} /></span><div><h2>{state.data.companyName || "УК вашего дома"}</h2><p>{house.address.replace(/^г\.\s*Казань,?\s*ул\.\s*/,"")}</p></div></div>
  <div className={styles.contactActions}>{email ? <a className={styles.contactAction} href={contactHref(email)}><span className={styles.icon}><Icon name="mail" /></span><span>Написать в УК</span><Icon name="arrow" /></a> : <button type="button" className={styles.contactAction} onClick={()=>setFeedback("Прямой чат с УК пока не подключён. Написать сотруднику можно в своём обращении.")}><span className={styles.icon}><Icon name="mail" /></span><span>Написать в УК</span><Icon name="arrow" /></button>}{dispatcher ? <a className={styles.contactAction} href={contactHref(dispatcher)} title={dispatcher.note}><span className={styles.icon}><Icon name="phone" /></span><span>Позвонить в диспетчерскую</span><Icon name="arrow" /></a> : <button className={styles.contactAction} type="button" onClick={()=>setFeedback("УК пока не указала номер диспетчерской.")}><span className={styles.icon}><Icon name="phone" /></span><span>Позвонить в диспетчерскую</span><Icon name="arrow" /></button>}</div>
  {feedback && <p className={styles.contactFeedback} role="status">{feedback}</p>}
  <h2 className={styles.infoTitle}>Информация</h2><div className={styles.infoCard}><div className={styles.infoRow}><Icon name="pin" /><strong>Адрес офиса</strong><span>{office?.value || "Не указан"}</span></div><div className={styles.infoRow}><Icon name="clock" /><strong>График работы</strong><span>{hours?.value || "Не указан"}</span></div><div className={styles.infoRow}><Icon name="people" /><strong>Приём жителей</strong><span>{reception?.value || "Не указан"}</span></div>{website && <div className={styles.infoRow}><Icon name="building" /><strong>Сайт УК</strong><a className={styles.websiteLink} href={contactHref(website)} target="_blank" rel="noopener noreferrer">{new URL(website.value).hostname}</a></div>}</div>
  <section className={styles.emergency}><div className={styles.emergencyTitle}><Icon name="warning" /><div><h2>Аварийная служба</h2><p>{emergency?.note || "Контакты добавит УК"}</p></div></div>{emergency ? <a className={styles.contactAction} href={contactHref(emergency)}><Icon name="phone" /><span>Позвонить</span><small>{emergency.value}</small><Icon name="arrow" size={16} /></a> : <button type="button" className={styles.contactAction} onClick={()=>setFeedback("Номер аварийной службы пока не добавлен.")}><Icon name="phone" /><span>Позвонить</span><small>Номер не указан</small><Icon name="arrow" size={16} /></button>}</section>
  {state.data.items.length>1 && <details className={styles.contactFeedback}><summary>Все контакты УК</summary><ul>{state.data.items.map((contact,index)=><li key={index}>{contact.label}: {contactHref(contact) ? <a href={contactHref(contact)}>{contact.value}</a>:contact.value}{contact.note && <small> · {contact.note}</small>}</li>)}</ul></details>}
 </>}</section>;
}
