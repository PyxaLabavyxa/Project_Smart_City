"use client";
import { useId, useRef } from "react";
import styles from "./number-choice.module.css";

export function NumberChoice({ label, value, count, onChange }: { label: string; value: number; count: number; onChange: (value: number) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const title = useId();
  function close() { dialog.current?.close(); trigger.current?.focus(); }
  return <>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={`${label}: ${value}`} aria-haspopup="dialog" onClick={() => {
      dialog.current?.showModal();
      dialog.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    }}><span>{label}<strong>{value}</strong></span><span aria-hidden="true">⌄</span></button>
    <dialog ref={dialog} aria-labelledby={title} className={styles.dialog} onClose={() => trigger.current?.focus()} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
    }}>
      <header><h2 id={title}>{label}</h2><button type="button" aria-label="Закрыть выбор" onClick={close}>×</button></header>
      <div className={styles.numbers} onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const offset = event.key === "ArrowUp" ? -4 : event.key === "ArrowDown" ? 4 : event.key === "ArrowLeft" ? -1 : 1;
        const next = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : (index + offset + count) % count;
        buttons[next]?.focus();
      }}>{Array.from({ length: count }, (_, index) => <button type="button" key={index} aria-pressed={value === index + 1} onClick={() => { onChange(index + 1); close(); }}>{index + 1}</button>)}</div>
    </dialog>
  </>;
}
