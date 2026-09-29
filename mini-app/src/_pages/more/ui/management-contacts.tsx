"use client";
import { useCallback } from "react";
import { useApi } from "@/shared/api/context";
import { useRemote } from "@/shared/api/use-remote";
import { RequestState } from "@/shared/ui/navigation/request-state";
import { getManagementContacts } from "@/entities/management-company/model/api";
import { contactHref } from "@/entities/management-company/model/contacts";
import styles from "./more-page.module.css";

export function ManagementContacts({ houseId }: { houseId: string }) {
  const api = useApi();
  const load = useCallback((signal: AbortSignal) => getManagementContacts(api, houseId, signal), [api, houseId]);
  const state = useRemote(load);
  return <section data-reveal="2" className={styles.contacts} aria-labelledby="management-contacts">
    <div className={styles.contactsHeading}><h2 id="management-contacts">Контакты УК</h2><button type="button" onClick={state.reload} disabled={state.loading} aria-label="Обновить контакты УК">Обновить</button></div>
    <RequestState {...state} />
    {!state.loading && !state.error && state.data && <>
      <p className={styles.company}>{state.data.companyName}</p>
      {state.data.items.length ? <ul className={styles.contactList}>{state.data.items.map((contact, index) => {
        const href = contactHref(contact);
        return <li data-reveal key={index}><span>{contact.label}</span>{href ? <a href={href} target={contact.kind === "website" ? "_blank" : undefined} rel={contact.kind === "website" ? "noopener noreferrer" : undefined}>{contact.value}</a> : <strong>{contact.value}</strong>}{contact.note && <small>{contact.note}</small>}</li>;
      })}</ul> : <p className={styles.emptyContacts}>УК пока не добавила контакты для этого дома. Вы можете создать обращение выше.</p>}
    </>}
  </section>;
}
