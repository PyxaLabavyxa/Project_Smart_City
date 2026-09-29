"use client";
import { useEffect, useRef, useState } from "react";
import type { DraftPhoto } from "@/entities/issue/model/issue-draft";
import { Icon } from "@/shared/ui/icon";
import styles from "./photo-picker.module.css";

function Thumbnail({ photo }: { photo: DraftPhoto }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(photo.file);
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [photo.file]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} alt={photo.file.name} width={160} height={160} />;
}

export function PhotoPicker({ photos, onChange, disabled = false }: { photos: DraftPhoto[]; onChange?: (photos: DraftPhoto[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  function select(files: File[]) {
    if (disabled || !onChange) return;
    const next = [...photos];
    const errors: string[] = [];
    for (const file of files) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { errors.push("Подойдут JPG, PNG и WebP."); continue; }
      if (!file.size || file.size > 10 * 1024 * 1024) { errors.push("Каждое фото должно быть не больше 10 МБ и не пустым."); continue; }
      if (next.some(photo => photo.file.name === file.name && photo.file.size === file.size && photo.file.lastModified === file.lastModified)) continue;
      if (next.length === 10) { errors.push("Можно прикрепить не больше 10 фотографий."); break; }
      next.push({ id: crypto.randomUUID(), file });
    }
    onChange(next);
    setError([...new Set(errors)].join(" "));
  }
  return <section className={styles.section} aria-label="Фотографии обращения">
    <div className={styles.heading}><div><h3>Фотографии</h3><p>{onChange ? "Покажите проблему — так её проще оценить" : "Отправим вместе с обращением"}</p></div><span>{photos.length} / 10</span></div>
    {photos.length > 0 && <ul className={styles.grid}>{photos.map((photo, index) => <li key={photo.id}><Thumbnail photo={photo} /><span className={styles.number}>{index + 1}</span>{onChange && <button type="button" disabled={disabled} className={styles.remove} aria-label={`Удалить фото ${index + 1}`} onClick={() => { onChange(photos.filter(item => item.id !== photo.id)); setError(""); }}><Icon name="close" size={16} /></button>}<span className={styles.filename}>{photo.file.name}</span></li>)}</ul>}
    {onChange && photos.length < 10 && <div className={styles.drop} data-dragging={dragging || undefined} onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); select(Array.from(event.dataTransfer.files)); }}>
      <input ref={input} className={styles.input} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} aria-label="Выбрать фотографии" onChange={event => { select(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      <button type="button" disabled={disabled} className={styles.add} onClick={() => input.current?.click()}><span className={styles.plus} aria-hidden="true">+</span><span><strong>{photos.length ? "Добавить ещё фото" : "Добавить фотографии"}</strong><small>Из галереи или перетащите сюда</small></span></button>
      <p>Необязательно · JPG, PNG, WebP · до 10 МБ каждое</p>
    </div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
