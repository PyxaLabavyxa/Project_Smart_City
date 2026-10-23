"use client";
import { useEffect, useRef, useState, useMemo, type ReactNode } from "react";
import type { Camera } from "../model/camera";
import type { CameraFrame, CameraGateway } from "../model/camera-gateway";
import { createCameraGateway } from "../model/api";
import { useApi } from "@/shared/api/context";
import styles from "./cameras.module.css";
import { CameraStatus } from "./camera-status";
import { Icon } from "@/shared/ui/icon";
import { RefreshButton } from "@/shared/ui/refresh-button";
type PreviewState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; frame: CameraFrame };
export function CameraPreview({ camera, gateway: providedGateway, compact = false, actions }: { camera: Camera; gateway?: CameraGateway; compact?: boolean; actions?: ReactNode }) {
  const api = useApi();
  const gateway = useMemo(() => providedGateway ?? createCameraGateway(api), [providedGateway, api]);
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [live, setLive] = useState(false);
  const [liveVersion, setLiveVersion] = useState(0);
  const [liveError, setLiveError] = useState(false);
  const [loadedFrame, setLoadedFrame] = useState<CameraFrame | null>(null);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const liveImage = useRef<HTMLImageElement>(null);
  const section = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(!compact);
  const [state, setState] = useState<PreviewState>({ kind: "loading" });
  const imageLoaded = state.kind === "ready" && loadedFrame?.src === state.frame.src && loadedFrame?.capturedAt === state.frame.capturedAt;
  const busy = useRef(true);
  useEffect(() => {
    if (!compact || !section.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "100px" });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [compact]);
  useEffect(() => {
    if (live || !visible) return;
    let current = true;
    busy.current = true;
    gateway.preview(camera, attempt).then(frame => { if (current) setState({ kind: "ready", frame }); })
      .catch((error: unknown) => { if (current) { setLoadedFrame(null); setState({ kind: "error", message: error instanceof Error ? error.message : "Изображение недоступно." }); } })
      .finally(() => { if (current) { busy.current = false; setRefreshing(false); } });
    return () => { current = false; };
  }, [camera, gateway, attempt, live, visible]);
  useEffect(() => {
    if (!visible || live || camera.liveAvailable) return;
    const refresh = () => {
      if (!document.hidden && !busy.current) {
        busy.current = true;
        setAttempt(value => value + 1);
      }
    };
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [visible, live, camera.liveAvailable]);
  useEffect(() => {
    if (!live) return;
    // MJPEG can keep the response open without dispatching load. A decoded
    // first frame is the evidence of availability, not a successful API call.
    const checkFrame = () => { if (liveImage.current?.naturalWidth) setLiveLoaded(true); };
    const readiness = window.setInterval(checkFrame, 250);
    checkFrame();
    return () => window.clearInterval(readiness);
  }, [live, liveVersion]);
  useEffect(() => {
    if (!live) return;
    const refresh = () => {
      if (document.hidden) setLive(false);
      else { setLiveLoaded(false); setLiveVersion(version => version + 1); }
    };
    const timer = window.setInterval(refresh, 35000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [live]);
  const liveUrl = `${(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "")}/cameras/${encodeURIComponent(camera.id)}/live?v=${liveVersion}`;
  function retry() { if (busy.current) return; busy.current = true; setRefreshing(true); if (state.kind !== "ready") { setLoadedFrame(null); setState({ kind: "loading" }); } setAttempt(value => value + 1); }
  const status = camera.status === "maintenance" ? "maintenance" : live ? liveLoaded ? "online" : "checking"
    : state.kind === "error" || liveError ? "unavailable" : state.kind === "ready" && imageLoaded ? "online" : "checking";
  const badge = <CameraStatus status={status} />;
  const overlayBadge = compact || status === "unavailable";
  const playbackControl = !compact && camera.liveAvailable ? <button type="button"
    className={`${styles.playbackControl} ${live ? styles.pauseControl : styles.playControl}`}
    aria-label={live ? "Остановить видео" : "Воспроизвести видео"} aria-pressed={live}
    onClick={() => { setLiveError(false); setLiveLoaded(false); setLive(value => !value); setLiveVersion(version => version + 1); }}>
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
      {live ? <><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></> : <path d="M8 4.5a1 1 0 0 1 1.5-.87l12 7.5a1 1 0 0 1 0 1.74l-12 7.5A1 1 0 0 1 8 19.5z" />}
    </svg>
  </button> : null;
  return <section ref={section} className={styles.previewSection} aria-label="Просмотр камеры">
    {live ? <figure className={styles.preview}>
      <div className={styles.playerSurface}>
      <img ref={liveImage} key={liveVersion} src={liveUrl} style={{ visibility: liveLoaded ? "visible" : "hidden" }} alt={`Прямой эфир камеры «${camera.name}»`} width={960} height={540} onLoad={() => setLiveLoaded(true)} onError={() => { setLiveLoaded(false); setLive(false); setLiveError(true); }} />
      {!liveLoaded && <div className={styles.imageLoading} role="status"><Icon name="camera" size={28} /><span>Подключаемся к камере…</span></div>}
      {playbackControl}</div>
      <figcaption>{!overlayBadge && badge}<span>Прямой эфир · без звука</span></figcaption>
    </figure> : state.kind === "ready" ? <figure className={styles.preview}>
      <div className={styles.playerSurface}>
      <img key={`${state.frame.capturedAt}:${state.frame.src}`} src={state.frame.src} style={{ visibility: imageLoaded ? "visible" : "hidden" }} referrerPolicy="no-referrer" alt={`Снимок камеры «${camera.name}»`} width={960} height={540} onLoad={async event => {
        const image = event.currentTarget;
        try { await image.decode(); } catch { if (image.isConnected) { setLoadedFrame(null); setState({ kind: "error", message: "Не удалось загрузить кадр. Повторите подключение." }); } return; }
        if (image.isConnected) setLoadedFrame(state.frame);
      }} onError={() => { setLoadedFrame(null); setState({ kind: "error", message: "Не удалось загрузить кадр. Повторите подключение." }); }} />
      {!imageLoaded && <div className={styles.imageLoading} role="status"><Icon name="camera" size={28} /><span>Загружаем кадр…</span></div>}
      {playbackControl}</div>
      <figcaption>{!overlayBadge && badge}<span>{!compact && "Обновлено "}{new Date(state.frame.capturedAt).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit", timeZone:"Europe/Moscow" }).replace(",", "")}</span></figcaption>
    </figure> : <div className={styles.playerSurface}><div className={styles.previewPlaceholder} aria-busy={state.kind === "loading"} data-maintenance={camera.status === "maintenance" || undefined} role={state.kind === "error" ? "alert" : "status"}>
      <div><Icon name={state.kind === "loading" ? "refresh" : "warning"} size={28} /><h2>{state.kind === "loading" ? "Загружаем кадр" : camera.status === "maintenance" ? "Техническое обслуживание" : compact ? "Камера недоступна" : "Нет изображения"}</h2>{!compact && <p>{state.kind === "loading" ? "Подключаемся к камере…" : state.message}</p>}</div>
    </div>{state.kind === "error" && playbackControl}</div>}
    {overlayBadge && <span className={styles.overlayStatus}>{badge}</span>}
    {!overlayBadge && state.kind !== "ready" && !live && <div className={styles.previewAvailability}>{badge}</div>}
    {!compact && (!camera.liveAvailable || liveError || actions) && <div className={styles.previewFooter}>
      {liveError && <p role="alert" className={styles.error}>Не удалось открыть эфир. Проверьте подключение камеры и повторите попытку.</p>}
      {!camera.liveAvailable && <RefreshButton className={styles.retry} onRefresh={retry} loading={refreshing || state.kind === "loading"} iconSize={17}>{state.kind === "error" ? "Повторить подключение" : "Обновить кадр"}</RefreshButton>}
      {actions}
    </div>}
  </section>;
}
