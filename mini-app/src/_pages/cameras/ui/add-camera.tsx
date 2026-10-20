"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LocationSelector, useHouseSelection, validLocation, type HouseLocation } from "@/entities/house";
import { useApi } from "@/shared/api/context";
import { endpoints } from "@/shared/api/client";
import { SectionPage } from "@/shared/ui/navigation";
import { parseCamera } from "../model/api";
import styles from "./cameras.module.css";

export function AddCameraPage() {
  const { house } = useHouseSelection();
  return <CameraForm key={house.id} />;
}

function CameraForm() {
  const { house, selected, choices } = useHouseSelection();
  const [place, setPlace] = useState<HouseLocation>(selected);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [isPublic, setPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const request = useRef<{ body: string; id: string } | null>(null);
  const submitted = useRef(false);
  const api = useApi();
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current) return;
    const problems: Record<string, string> = {};
    if (!name.trim()) problems.name = "Укажите название камеры";
    try {
      const url = new URL(source.trim());
      if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error();
    } catch { problems.source = "Укажите HTTPS-ссылку на снимок без логина и пароля"; }
    if (!validLocation(house, place)) problems.place = "Выберите место камеры";
    if (place.zone === "apartment" && !choices.some(choice => choice.houseId === house.id && choice.apartment === place.apartment)) problems.place = "Выберите свою квартиру или общую зону";
    setErrors(problems);
    if (Object.keys(problems).length) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const apartment = place.zone === "apartment" ? house.apartments?.find(a => a.number === place.apartment) : null;
    const data = { name: name.trim(), source_url: source.trim(), note: note.trim(), is_public: isPublic,
      place: { entrance: place.entrance, floor: place.floor, zone: place.zone, apartment_id: apartment?.id ?? null } };
    const body = JSON.stringify(data);
    if (request.current?.body !== body) request.current = { body, id: crypto.randomUUID() };
    submitted.current = true; setSaving(true); setError("");
    try {
      const camera = parseCamera(await api(endpoints.cameras(house.id), { body: { ...data, request_id: request.current.id } }), house);
      router.push(`/cameras/${camera.id}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось добавить камеру");
      submitted.current = false; setSaving(false);
    }
  }
  const fieldError = (key: string) => errors[key] ? <span id={`camera-${key}-error`} className={styles.error} role="alert">{errors[key]}</span> : null;
  return <SectionPage title="Добавить камеру" description={house.address} backHref="/cameras" backLabel="Все камеры">
    <form className={styles.form} onSubmit={submit} noValidate aria-busy={saving}>
      <fieldset disabled={saving}>
        <legend>Подключение</legend>
        <label>Название<input name="camera-name" value={name} onChange={event => setName(event.target.value)} maxLength={200} placeholder="Камера у входа" aria-invalid={!!errors.name} aria-describedby={errors.name ? "camera-name-error" : undefined} />{fieldError("name")}</label>
        <label>HTTPS-ссылка на снимок<input name="camera-source" type="url" inputMode="url" value={source} onChange={event => setSource(event.target.value)} maxLength={2000} placeholder="https://camera.example/snapshot.jpg" aria-invalid={!!errors.source} aria-describedby={errors.source ? "camera-source-error" : "camera-source-help"} />{fieldError("source")}</label>
        <p id="camera-source-help" className={styles.hint}>Прямая ссылка на JPEG или PNG, доступная с вашего устройства. Кадр обновляется каждые 5 секунд.</p>
        <label><span className={styles.fieldLabel}>Описание <span className={styles.hint}>(необязательно)</span></span><textarea name="camera-note" value={note} onChange={event => setNote(event.target.value)} maxLength={1000} rows={3} placeholder="Что видно в кадре" /></label>
      </fieldset>
      <fieldset disabled={saving} tabIndex={-1} aria-invalid={!!errors.place} aria-describedby={errors.place ? "camera-place-error" : undefined}>
        <legend>Где расположена камера?</legend>
        <LocationSelector value={place} onChange={setPlace} />{fieldError("place")}
      </fieldset>
      <fieldset disabled={saving}>
        <legend>Кто может смотреть?</legend>
        <label className={styles.radio}><input type="radio" name="camera-visibility" checked={!isPublic} onChange={() => setPublic(false)} /><span><strong>Только я</strong><small>Личная камера добавится сразу.</small></span></label>
        <label className={styles.radio}><input type="radio" name="camera-visibility" checked={isPublic} onChange={() => setPublic(true)} /><span><strong>Жители моего дома</strong><small>Камера появится у соседей после одобрения УК. До этого её видите только вы.</small></span></label>
      </fieldset>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button className={styles.addButton} type="submit" disabled={saving}>{saving ? "Сохраняем…" : isPublic ? "Отправить на модерацию" : "Добавить камеру"}</button>
      <Link className={styles.cancel} href="/cameras" aria-disabled={saving} onClick={event => { if (saving) event.preventDefault(); }}>Отмена</Link>
    </form>
  </SectionPage>;
}
