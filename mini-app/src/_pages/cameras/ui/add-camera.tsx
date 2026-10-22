"use client";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LocationSelector, useHouseSelection, validLocation, type HouseLocation } from "@/entities/house";
import { useApi } from "@/shared/api/context";
import { endpoints } from "@/shared/api/client";
import { SectionPage } from "@/shared/ui/navigation";
import { RequestState } from "@/shared/ui/navigation/request-state";
import { useRemote } from "@/shared/api/use-remote";
import { record, string, number } from "@/shared/api/parse";
import { parseCamera } from "../model/api";
import { useCameraProbe } from "../model/use-camera-probe";
import { cameraLinkError } from "../model/camera-source";
import { Icon } from "@/shared/ui/icon";
import { useConfirmation } from "@/shared/ui/confirmation";
import styles from "./cameras.module.css";

export function AddCameraPage() {
  const { house } = useHouseSelection();
  return <CameraForm key={house.id} />;
}

type CameraSettings = { id: string; name: string; note: string; source_url: string; source_type: string; username: string; auth_type: string; profile: string; rtsp_port: number | null; password_set: boolean; is_public: boolean; version: string };

export function CameraSettingsPage({ id }: { id: string }) {
  const api = useApi();
  const { house } = useHouseSelection();
  const load = useCallback(async (signal: AbortSignal): Promise<CameraSettings> => {
    const data = record(await api(`/cameras/${encodeURIComponent(id)}/settings`, { signal }));
    if (String(number(data.house_id)) !== house.id) throw new Error("Выберите дом этой камеры, чтобы открыть настройки");
    if (typeof data.password_set !== "boolean" || typeof data.is_public !== "boolean") throw new Error("Не удалось загрузить настройки камеры");
    return { id: string(data.id), name: string(data.name), note: string(data.note), source_url: string(data.source_url), source_type: string(data.source_type), username: string(data.username), auth_type: string(data.auth_type), profile: string(data.profile), rtsp_port: data.rtsp_port == null ? null : number(data.rtsp_port), password_set: data.password_set, is_public: data.is_public, version: string(data.version) };
  }, [api, id, house.id]);
  const state = useRemote(load);
  if (state.data) return <CameraForm key={`${id}:${state.data.version}`} initial={state.data} />;
  return <SectionPage title="Настройки камеры" backHref={`/cameras/${id}`} backLabel="К камере"><RequestState {...state} page /></SectionPage>;
}

function CameraForm({ initial }: { initial?: CameraSettings }) {
  const confirm = useConfirmation();
  const { house, selected, choices } = useHouseSelection();
  const [place, setPlace] = useState<HouseLocation>(selected);
  const [name, setName] = useState(initial?.name ?? "");
  const [source, setSource] = useState(initial?.source_url ?? "");
  const [sourceType, setSourceType] = useState(initial?.source_type ?? "auto");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [keepPassword, setKeepPassword] = useState(initial?.password_set ?? false);
  const [authType, setAuthType] = useState(initial?.auth_type ?? "digest");
  const [profile, setProfile] = useState(initial?.profile ?? "");
  const [rtspPort, setRtspPort] = useState(initial?.rtsp_port == null ? "" : String(initial.rtsp_port));
  const [note, setNote] = useState(initial?.note ?? "");
  const [isPublic, setPublic] = useState(initial?.is_public ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const request = useRef<{ body: string; id: string } | null>(null);
  const submitted = useRef(false);
  const api = useApi();
  const router = useRouter();
  const connection = { source_url: source.trim(), source_type: sourceType, username, password, auth_type: authType, profile: sourceType === "onvif" || sourceType === "auto" ? profile : "", rtsp_port: (sourceType === "onvif" || sourceType === "auto") && rtspPort ? Number(rtspPort) : null };
  const linkError = cameraLinkError(source, sourceType);
  const probe = useCameraProbe(api, `${endpoints.cameras(house.id)}/probe`, JSON.stringify({ ...connection, camera_id: initial ? Number(initial.id) : null, keep_password: keepPassword }), !linkError);
  const probeStatus = source.trim() && linkError ? "invalid" : probe.status;
  const detectedType = probe.status === "success" ? probe.sourceType ?? sourceType : sourceType;
  const typeLabels: Record<string, string> = { snapshot: "Снимки", mjpeg: "MJPEG", hls: "HLS", rtsp: "RTSP", rtmp: "RTMP", onvif: "ONVIF", http_video: "HTTP-видео" };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current) return;
    const problems: Record<string, string> = {};
    if (!name.trim()) problems.name = "Укажите название камеры";
    if (linkError) problems.source = linkError;
    if (!initial && !validLocation(house, place)) problems.place = "Выберите место камеры";
    if (!initial && place.zone === "apartment" && !choices.some(choice => choice.houseId === house.id && choice.apartment === place.apartment)) problems.place = "Выберите свою квартиру или общую зону";
    setErrors(problems);
    if (Object.keys(problems).length) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const apartment = place.zone === "apartment" ? house.apartments?.find(a => a.number === place.apartment) : null;
    if (probe.status !== "success") return;
    const data = { ...connection, source_type: detectedType, name: name.trim(), note: note.trim(), is_public: isPublic };
    const body = JSON.stringify({ ...data, ...(!initial ? { place } : {}) });
    if (request.current?.body !== body) request.current = { body, id: crypto.randomUUID() };
    submitted.current = true; setSaving(true); setError("");
    try {
      const payload = initial ? { ...data, keep_password: keepPassword, expected_version: initial.version }
        : { ...data, request_id: request.current.id, place: { entrance: place.entrance, floor: place.floor, zone: place.zone, apartment_id: apartment?.id ?? null } };
      const camera = parseCamera(await api(initial ? `/cameras/${initial.id}/settings` : endpoints.cameras(house.id), { body: payload }), house);
      router.push(`/cameras/${camera.id}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось добавить камеру");
      submitted.current = false; setSaving(false);
    }
  }
  async function remove() {
    if (!initial || submitted.current) return;
    if (!await confirm({ title: "Удалить камеру?", description: `«${name}» исчезнет из приложения у вас и жителей дома. Это действие нельзя отменить.`, confirmLabel: "Удалить", destructive: true }) || submitted.current) return;
    submitted.current = true; setSaving(true); setError("");
    try {
      await api(`/cameras/${initial.id}`, { method: "DELETE" });
      router.replace("/cameras");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось удалить камеру");
      submitted.current = false; setSaving(false);
    }
  }
  const fieldError = (key: string) => errors[key] ? <span id={`camera-${key}-error`} className={styles.error} role="alert">{errors[key]}</span> : null;
  return <SectionPage title={initial ? "Настройки камеры" : "Добавить камеру"} description={house.address} backHref={initial ? `/cameras/${initial.id}` : "/cameras"} backLabel={initial ? "К камере" : "Все камеры"}>
    <form className={`${styles.form} ${initial ? styles.settingsForm : ""}`} onSubmit={submit} noValidate aria-busy={saving}>
      <fieldset disabled={saving}>
        <legend><Icon name="camera" size={20} />О камере</legend>
        <label>Название<input name="camera-name" value={name} onChange={event => setName(event.target.value)} maxLength={200} placeholder="Камера у входа" aria-invalid={!!errors.name} aria-describedby={errors.name ? "camera-name-error" : undefined} />{fieldError("name")}</label>
        <label><span className={styles.fieldLabel}>Описание <span className={styles.hint}>(необязательно)</span></span><textarea name="camera-note" value={note} onChange={event => setNote(event.target.value)} maxLength={1000} rows={2} placeholder="Что видно в кадре" /></label>
      </fieldset>
      <fieldset disabled={saving}>
        <legend><Icon name="settings" size={20} />Подключение</legend>
        <label>Ссылка на камеру<input name="camera-source" type="url" inputMode="url" value={source} onChange={event => { setSource(event.target.value); setSourceType("auto"); }} maxLength={2000} placeholder="Вставьте ссылку на камеру" aria-invalid={probeStatus === "invalid"} aria-describedby="camera-probe" /></label>
        <div id="camera-probe" className={styles.connectionCheck} data-status={probeStatus} role="status" aria-live="polite">
          <span title={probe.status === "error" ? probe.error : undefined}>{probeStatus === "invalid" ? linkError : probe.status === "idle" ? "Тип определится автоматически" : probe.status === "checking" ? "Проверяем камеру…" : probe.status === "success" ? `Кадр получен · ${typeLabels[detectedType] ?? detectedType}` : "Не удалось подключиться"}</span>
          {(probe.status === "success" || probe.status === "error") && probeStatus !== "invalid" && <button type="button" onClick={probe.retry}>{probe.status === "error" ? "Повторить" : "Обновить"}</button>}
        </div>
        {/* Live camera frames must bypass image optimization and its cache. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {probe.status === "success" && probe.src && <img className={styles.probePreview} src={probe.src} alt="Проверочный кадр с камеры" width={640} height={360} />}
        <details className={styles.connectionOptions}><summary>Тип подключения и дополнительные параметры</summary>
        <p className={styles.hint}>Камера должна быть доступна по публичному адресу.</p>
        <label>Тип подключения<select value={sourceType} onChange={event => setSourceType(event.target.value)}>
          <option value="auto">Определить автоматически</option>
          <option value="rtsp">RTSP / RTSPS</option>
          <option value="onvif">ONVIF</option>
          <option value="snapshot">Снимки HTTP / HTTPS</option>
          <option value="mjpeg">MJPEG</option>
          <option value="hls">HLS (.m3u8)</option>
          <option value="rtmp">RTMP / RTMPS</option>
          <option value="http_video">HTTP-видео</option>
        </select></label>
        {(sourceType === "onvif" || sourceType === "auto" || detectedType === "onvif") && <><label>Профиль ONVIF (необязательно)<input value={profile} onChange={event => setProfile(event.target.value)} maxLength={128} placeholder="Первый профиль по умолчанию" /></label><label>Внешний RTSP-порт (необязательно)<input type="number" min="1" max="65535" value={rtspPort} onChange={event => setRtspPort(event.target.value)} placeholder="Обычно 554" /></label></>}
        </details>
        <details className={styles.connectionOptions}><summary><Icon name="lock" size={18} /><span>Логин и пароль камеры</span><Icon name="arrow" size={16} /></summary>
          <label>Логин<input name="camera-username" value={username} onChange={event => setUsername(event.target.value)} maxLength={200} autoComplete="off" /></label>
          <label>Пароль<input name="camera-password" type="password" value={password} onChange={event => { setPassword(event.target.value); setKeepPassword(!event.target.value && !!initial?.password_set); }} maxLength={500} autoComplete="new-password" placeholder={keepPassword ? "Сохранённый пароль не изменится" : undefined} /></label>
          {initial?.password_set && <button type="button" className={styles.resetFilters} onClick={() => { setPassword(""); setKeepPassword(false); }}>Очистить сохранённый пароль</button>}
          <label>Авторизация<select value={authType} onChange={event => setAuthType(event.target.value)}><option value="digest">Digest — обычно для IP-камер</option><option value="basic">Basic</option></select></label>
          <p className={styles.hint}>Сохранённые данные подключения зашифрованы и не передаются другим жителям.</p>
        </details>
      </fieldset>
      {!initial && <fieldset disabled={saving} tabIndex={-1} aria-invalid={!!errors.place} aria-describedby={errors.place ? "camera-place-error" : undefined}>
        <legend>Где расположена камера?</legend>
        <LocationSelector value={place} onChange={setPlace} />{fieldError("place")}
      </fieldset>}
      <fieldset disabled={saving}>
        <legend><Icon name="lock" size={20} />Доступ</legend>
        <label className={styles.radio}><input type="radio" name="camera-visibility" checked={!isPublic} onChange={() => setPublic(false)} /><span><strong>Только я</strong><small>{initial ? "Личная камера, доступная только вам" : "Личная камера добавится сразу."}</small></span></label>
        <label className={styles.radio}><input type="radio" name="camera-visibility" checked={isPublic} onChange={() => setPublic(true)} /><span><strong>Жители дома</strong><small>Общий доступ после одобрения УК</small></span></label>
      </fieldset>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {initial && isPublic && <p className={styles.hint}>После изменения общедоступная камера снова отправится на модерацию.</p>}
      <div className={styles.formActions}>
      <button className={styles.addButton} type="submit" disabled={saving || probe.status !== "success"}>{saving ? "Сохраняем…" : initial ? "Сохранить" : isPublic ? "Отправить на модерацию" : "Добавить камеру"}</button>
      {initial && <button type="button" className={styles.deleteCamera} onClick={remove} disabled={saving}>Удалить камеру</button>}
      <Link className={styles.cancel} href={initial ? `/cameras/${initial.id}` : "/cameras"} aria-disabled={saving} onClick={event => { if (saving) event.preventDefault(); }}>Отмена</Link>
      </div>
    </form>
  </SectionPage>;
}
