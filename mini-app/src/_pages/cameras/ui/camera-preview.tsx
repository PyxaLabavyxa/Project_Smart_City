"use client";
import { useEffect, useRef, useState } from "react";
import type { Camera } from "../model/demo-cameras";
import type { CameraFrame, CameraGateway } from "../model/camera-gateway";
import { mockCameraGateway } from "@/mocks/camera-gateway";
import styles from "./cameras.module.css";
import { CameraStatus } from "./camera-status";
import { Icon } from "@/shared/ui/icon";
import { cameraImage } from "../model/demo-cameras";
type PreviewState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; frame: CameraFrame };
export function CameraPreview({ camera, gateway = mockCameraGateway }: { camera: Camera; gateway?: CameraGateway }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PreviewState>({ kind: "loading" });
  const busy = useRef(true);
  useEffect(() => {
    let current = true;
    gateway.preview(camera, attempt).then(frame => { if (current) setState({ kind: "ready", frame }); })
      .catch((error: unknown) => { if (current) setState({ kind: "error", message: error instanceof Error ? error.message : "Изображение недоступно." }); })
      .finally(() => { if (current) busy.current = false; });
    return () => { current = false; };
  }, [camera, gateway, attempt]);
  function retry() { if (busy.current) return; busy.current = true; setState({ kind: "loading" }); setAttempt(value => value + 1); }
  return <section className={styles.previewSection} aria-label="Просмотр камеры">
    {state.kind === "ready" ? <figure className={styles.preview}>
      {/* Static local fixture; no video stream. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={state.frame.src} alt="Условное изображение общей зоны дома" width={960} height={540} onError={() => setState({ kind: "error", message: "Не удалось загрузить кадр. Повторите подключение." })} />
      <figcaption>Кадр от {new Date(state.frame.capturedAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}</figcaption>
    </figure> : <div className={styles.previewPlaceholder} data-maintenance={camera.status === "maintenance" || undefined} role={state.kind === "error" ? "alert" : "status"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cameraImage(camera)} alt="" width={960} height={540} />
      <div><Icon name={state.kind === "loading" ? "refresh" : "warning"} size={28} /><h2>{state.kind === "loading" ? "Загружаем кадр" : camera.status === "maintenance" ? "Техническое обслуживание" : "Нет изображения"}</h2><p>{state.kind === "loading" ? "Подключаемся к камере…" : state.message}</p></div>
    </div>}
    <div className={styles.previewFooter}><CameraStatus status={state.kind === "ready" ? "online" : state.kind === "error" && camera.status !== "maintenance" ? "unavailable" : camera.status} />
    <button className={styles.retry} onClick={retry} disabled={state.kind === "loading"}><Icon name="refresh" size={17} />{state.kind === "error" ? "Повторить подключение" : "Обновить кадр"}</button></div>
  </section>;
}
