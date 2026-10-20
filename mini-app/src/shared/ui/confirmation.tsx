"use client";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icon";
import styles from "./confirmation.module.css";

type Confirmation = { title: string; description: string; confirmLabel: string; destructive?: boolean };
type Request = Confirmation & { resolve: (confirmed: boolean) => void };
const ConfirmationContext = createContext<(options: Confirmation) => Promise<boolean>>(async () => false);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const pending = useRef<Request | null>(null);
  const confirm = useCallback((options: Confirmation) => {
    if (pending.current) return Promise.resolve(false);
    return new Promise<boolean>(resolve => {
      const next = { ...options, resolve };
      pending.current = next;
      setRequest(next);
    });
  }, []);
  useEffect(() => () => { pending.current?.resolve(false); pending.current = null; }, []);
  function finish(confirmed: boolean) {
    const current = pending.current;
    pending.current = null;
    setRequest(null);
    current?.resolve(confirmed);
  }
  return <ConfirmationContext value={confirm}>{children}{request && <ConfirmationDialog request={request} onFinish={finish} />}</ConfirmationContext>;
}

function ConfirmationDialog({ request, onFinish }: { request: Request; onFinish: (confirmed: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => { dialog.current?.showModal(); cancel.current?.focus({ preventScroll: true }); }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={event => { event.preventDefault(); dialog.current?.close("cancel"); }}
    onClose={event => onFinish(event.currentTarget.returnValue === "confirm")}>
    <div className={styles.heading}><span className={styles.symbol} data-destructive={request.destructive || undefined}><Icon name={request.destructive ? "trash" : "warning"} size={24} /></span><button type="button" className={styles.close} aria-label="Закрыть подтверждение" onClick={() => dialog.current?.close("cancel")}><Icon name="close" size={21} /></button></div>
    <h2 id={`${id}-title`}>{request.title}</h2>
    <p id={`${id}-description`}>{request.description}</p>
    <div className={styles.actions}><button ref={cancel} type="button" className={styles.button} onClick={() => dialog.current?.close("cancel")}>Отмена</button><button type="button" className={`${styles.button} ${styles.confirm}`} data-destructive={request.destructive || undefined} onClick={() => dialog.current?.close("confirm")}>{request.confirmLabel}</button></div>
  </dialog>;
}

export function useConfirmation() { return useContext(ConfirmationContext); }
