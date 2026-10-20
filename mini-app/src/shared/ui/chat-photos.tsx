"use client";
import { useEffect, useRef, useState } from "react";
import type { ChatDraftPhoto, ChatPhoto } from "../api/chat-photos";
import { Icon } from "./icon";
import styles from "./chat-screen.module.css";

function DraftThumbnail({ photo }: { photo: ChatDraftPhoto }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(photo.file);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [photo.file]);
  return <img ref={ref} alt={photo.file.name} width={64} height={64} />;
}

export function ChatPhotoPicker({ photos, onChange, disabled }: {
  photos: readonly ChatDraftPhoto[]; onChange: (photos: ChatDraftPhoto[]) => void; disabled: boolean;
}) {
  const [error, setError] = useState("");
  return <div className={styles.attachments}>
    <label className={styles.attachButton} aria-disabled={disabled || photos.length >= 10}>
      <span aria-hidden="true">＋</span> Фото{photos.length > 0 ? ` · ${photos.length}/10` : ""}
      <input className={styles.photoInput} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || photos.length >= 10} aria-label="Прикрепить фотографии" onChange={event => {
        const next = [...photos]; const errors = new Set<string>();
        for (const file of Array.from(event.target.files ?? [])) {
          if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { errors.add("Подойдут JPG, PNG и WebP."); continue; }
          if (!file.size || file.size > 10 * 1024 * 1024) { errors.add("Фото должно быть от 1 байта до 10 МБ."); continue; }
          if (next.some(p => p.file.name === file.name && p.file.size === file.size && p.file.lastModified === file.lastModified)) continue;
          if (next.length >= 10) { errors.add("Можно прикрепить до 10 фото."); break; }
          next.push({ id: crypto.randomUUID(), file });
        }
        onChange(next); setError([...errors].join(" ")); event.target.value = "";
      }} />
    </label>
    {photos.length > 0 && <ul className={styles.draftPhotos}>{photos.map((photo, index) => <li key={photo.id}><DraftThumbnail photo={photo} /><button type="button" disabled={disabled} aria-label={`Убрать фото ${index + 1}`} onClick={() => { onChange(photos.filter(p => p.id !== photo.id)); setError(""); }}><Icon name="close" size={13} /></button></li>)}</ul>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div>;
}

export function ChatPhotos({ photos = [], onLoad }: { photos?: readonly ChatPhoto[]; onLoad?: () => void }) {
  const [selected, setSelected] = useState<ChatPhoto | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
  const url = (photo: ChatPhoto) => `${api.replace(/\/api\/v1\/?$/, "")}${photo.url}`;
  useEffect(() => {
    if (!selected) return;
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, [selected]);
  if (!photos.length) return null;
  return <><div className={styles.messagePhotos}>{photos.map((photo, index) => <button key={photo.id} type="button" aria-label={`Открыть фото ${index + 1}`} onClick={() => setSelected(photo)}><img src={url(photo)} alt={`Фото в сообщении ${index + 1}`} width={220} height={170} loading="lazy" onLoad={onLoad} /></button>)}</div>
    {selected && <dialog ref={dialog} className={styles.photoViewer} aria-label="Просмотр фотографии" onCancel={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}><button type="button" autoFocus aria-label="Закрыть фотографию" onClick={() => setSelected(null)}><Icon name="close" /></button><img src={url(selected)} alt="Фотография крупным планом" /></dialog>}
  </>;
}
