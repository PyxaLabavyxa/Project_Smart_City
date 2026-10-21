"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { useHouseSelection } from "@/entities/house";
import { useApi } from "@/shared/api/context";
import { apiUrl, endpoints, maxLaunchData } from "@/shared/api/client";
import { useRemote } from "@/shared/api/use-remote";
import { Icon } from "@/shared/ui/icon";
import { SectionPage } from "@/shared/ui/navigation";
import { RequestState } from "@/shared/ui/navigation/request-state";
import { Zhorik } from "@/shared/ui/zhorik";
import { parseInvitation } from "./model";
import styles from "./invite-neighbors.module.css";

type DownloadBridge = { downloadFile?: (url: string, filename: string) => Promise<unknown> };

export function InviteNeighbors() {
  const { house } = useHouseSelection();
  return <Invitation key={house.id} houseId={house.id} />;
}

function Invitation({ houseId }: { houseId: string }) {
  const api = useApi();
  const load = useCallback(async (signal: AbortSignal) => parseInvitation(await api(endpoints.invitation(houseId), { signal }), houseId), [api, houseId]);
  const state = useRemote(load);
  const input = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);

  async function copy() {
    if (!state.data) return;
    try {
      await navigator.clipboard.writeText(state.data.url);
      setFeedback("Ссылка скопирована. Отправьте её соседям.");
    } catch {
      input.current?.focus(); input.current?.select();
      setFeedback("Скопируйте выделенную ссылку и отправьте её соседям.");
    }
  }

  async function download(path: string, filename: string) {
    if (downloading) return;
    setDownloading(true); setDownloadError(""); setFeedback("");
    try {
      const url = new URL(apiUrl(path), window.location.href).href;
      const bridge = (window as Window & { WebApp?: DownloadBridge }).WebApp;
      if (maxLaunchData() && bridge?.downloadFile) {
        if (!url.startsWith("https://")) throw new Error("Для скачивания в MAX нужна защищённая ссылка. В локальном браузере скачивание доступно.");
        await bridge.downloadFile(url, filename);
      } else {
        const response = await fetch(url, { credentials: "omit", signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error("Не удалось скачать файл. Повторите попытку.");
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = objectUrl; link.download = filename;
        document.body.append(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      }
      setFeedback("Файл передан на скачивание.");
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Не удалось скачать файл. Повторите попытку.");
    } finally { setDownloading(false); }
  }

  return <SectionPage title="Пригласить соседей" description="Пусть весь дом будет на связи">
    {!state.data ? <RequestState {...state} /> : <div className={styles.content}>
      <div className={styles.intro}><div><h2>Соседи, вы с нами?</h2><p>Покажите QR-код или отправьте ссылку в чат. Ваш дом уже будет выбран при регистрации.</p></div><Zhorik pose="wave" className={styles.mascot} /></div>
      <section className={styles.invitation} aria-labelledby="invite-address">
        <p className={styles.address} id="invite-address"><Icon name="pin" size={19} />{state.data.address}</p>
        <div className={styles.qr}>
          {qrFailed ? <p role="alert">Не удалось загрузить QR-код.<button type="button" onClick={() => { setQrFailed(false); state.reload(); }}>Повторить</button></p> : <Image src={apiUrl(state.data.qrPath)} alt={`QR-код приглашения: ${state.data.address}`} width={600} height={600} unoptimized loading="eager" onError={() => setQrFailed(true)} />}
        </div>
        <p className={styles.caption}>Наведите камеру телефона.<br />Домовед откроется в MAX.</p>
        <button type="button" className={styles.primary} onClick={() => void copy()}><Icon name="copy" />Скопировать ссылку</button>
        <label className={styles.linkLabel} htmlFor="house-invitation-url">Ссылка на ваш дом</label>
        <input ref={input} id="house-invitation-url" readOnly value={state.data.url} className={styles.link} onFocus={event => event.currentTarget.select()} />
        <button type="button" className={styles.textButton} disabled={downloading} onClick={() => void download(state.data!.qrPath, `domoved-house-${houseId}-qr.png`)}><Icon name="download" size={18} />Скачать QR-код</button>
      </section>
      <section className={styles.posterSection} aria-labelledby="invitation-poster-title">
        <div className={styles.posterHeading}><Icon name="receipt" size={25} /><div><h2 id="invitation-poster-title">Для вашего подъезда</h2><p>Готовая листовка A4 с Жориком, адресом и QR-кодом. Скачайте и распечатайте.</p></div></div>
        <details className={styles.preview}><summary>Посмотреть листовку</summary><Image src={apiUrl(state.data.posterPath)} alt={`Листовка для подъезда: ${state.data.address}`} width={2480} height={3508} unoptimized loading="lazy" /></details>
        <button type="button" className={styles.secondary} disabled={downloading} onClick={() => void download(state.data!.pdfPath, `domoved-house-${houseId}-a4.pdf`)}><Icon name="download" />{downloading ? "Подготавливаем файл…" : "Скачать листовку · PDF"}</button>
        <button type="button" className={styles.textButton} disabled={downloading} onClick={() => void download(state.data!.posterPath, `domoved-house-${houseId}-a4.png`)}>Скачать картинкой · PNG</button>
      </section>
      <p className={styles.feedback} role="status" aria-live="polite">{feedback}</p>
      {downloadError && <p className={styles.error} role="alert">{downloadError}</p>}
      <p className={styles.note}>Ссылка постоянная и ведёт в этот дом. Номер квартиры каждый сосед указывает сам.</p>
    </div>}
  </SectionPage>;
}
