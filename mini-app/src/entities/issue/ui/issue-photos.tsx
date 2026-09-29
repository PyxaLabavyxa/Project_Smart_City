"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/shared/ui/icon";
import styles from "./issue-photos.module.css";

export function IssuePhotos({ issueId, ids }: { issueId: string; ids: readonly number[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
  const url = (id: number) => `${base}/issues/${encodeURIComponent(issueId)}/photos/${id}`;
  useEffect(() => {
    if (selected === null) return;
    const element = dialog.current;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = overflow; };
  }, [selected]);
  if (!ids.length) return null;
  return <section className={styles.section} aria-label="Фотографии обращения"><h2>Фотографии <span>{ids.length}</span></h2><div className={styles.grid}>{ids.map((id, index) => <button key={id} type="button" onClick={() => setSelected(id)} aria-label={`Открыть фото ${index + 1}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url(id)} alt={`Фото проблемы ${index + 1}`} width={200} height={160} loading="lazy" />
  </button>)}</div><p>Нажмите на снимок, чтобы рассмотреть детали</p>
    {selected !== null && <dialog ref={dialog} className={styles.viewer} aria-label="Просмотр фотографии" onCancel={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}><button type="button" autoFocus className={styles.close} onClick={() => setSelected(null)} aria-label="Закрыть фотографию"><Icon name="close" /></button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url(selected)} alt="Фотография обращения крупным планом" />
      <div className={styles.controls}><button type="button" disabled={ids.indexOf(selected) === 0} onClick={() => setSelected(ids[ids.indexOf(selected) - 1])}>← Назад</button><span>{ids.indexOf(selected) + 1} / {ids.length}</span><button type="button" disabled={ids.indexOf(selected) === ids.length - 1} onClick={() => setSelected(ids[ids.indexOf(selected) + 1])}>Далее →</button></div>
    </dialog>}
  </section>;
}
