"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Icon } from "@/shared/ui/icon";
import { tourSteps as steps } from "./steps";
import { tourLayout, type TourRect } from "./tour-layout";
import styles from "./onboarding.module.css";
import { prepareTour } from "./prepare";
import { useIssues } from "@/entities/issue";
import { useMessages } from "@/entities/message";
import { useUtilityAccount } from "@/entities/utilities";

const Context = createContext<{ start: () => void; activeTarget: string | null }>({ start: () => {}, activeTarget: null });
export const useOnboarding = () => useContext(Context);
type Position = { spot: TourRect; card: { left: number; top: number }; missing: boolean };

export function OnboardingProvider({ userId, children }: { userId: number; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<number | null>(null);
  const [preparation, setPreparation] = useState<{ done: number; total: number; error?: string } | null>({ done: 0, total: 11 });
  const preparationRun = useRef<AbortController | null>(null);
  const prepared = useRef(false);
  const guideAfterPreparation = useRef(true);
  const issues = useIssues();
  const messages = useMessages();
  const utilities = useUtilityAccount();
  const [destination, setDestination] = useState("/");
  const [position, setPosition] = useState<Position | null>(null);
  const cameraPath = useRef("/cameras");
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnTo = useRef("/");
  const isOpen = step !== null || preparation !== null;
  // Show the restored guide once after an apartment becomes available, including bot registration.
  const storageKey = `dompulse:onboarding:registration:v2:${userId}`;
  const prepare = useCallback(async (showGuide: boolean) => {
    guideAfterPreparation.current = showGuide;
    if (!preparationRun.current) returnTo.current = window.location.pathname + window.location.search;
    preparationRun.current?.abort();
    const controller = new AbortController();
    preparationRun.current = controller;
    setStep(null);
    setPosition(null);
    setPreparation({ done: 0, total: 11 });
    try {
      cameraPath.current = await prepareTour(router, controller.signal, (done, total) => setPreparation({ done, total }), showGuide ? "/" : returnTo.current);
      if (controller.signal.aborted) return;
      prepared.current = true;
      preparationRun.current = null;
      setPreparation(null);
      if (showGuide) {
        setDestination("/");
        setStep(0);
        try { localStorage.setItem(storageKey, "done"); } catch { /* Storage may be disabled. */ }
      }
    } catch (error) {
      if (!controller.signal.aborted) setPreparation(previous => ({ done: previous?.done ?? 0, total: previous?.total ?? 11, error: error instanceof Error ? error.message : "Не удалось подготовить разделы" }));
    }
  }, [router, storageKey]);
  const start = useCallback(() => {
    if (!prepared.current) { void prepare(true); return; }
    returnTo.current = window.location.pathname + window.location.search;
    setPosition(null);
    setDestination("/");
    setStep(0);
    router.replace("/", { scroll: false });
  }, [prepare, router]);
  useEffect(() => () => preparationRun.current?.abort(), []);
  function finish() {
    preparationRun.current?.abort();
    preparationRun.current = null;
    setPreparation(null);
    try { localStorage.setItem(storageKey, "done"); } catch { /* Some webviews disable storage. */ }
    setStep(null);
    setPosition(null);
    router.replace(returnTo.current, { scroll: true });
  }
  useEffect(() => {
    let showGuide = true;
    try { showGuide = localStorage.getItem(storageKey) !== "done"; } catch { /* Storage may be disabled. */ }
    const timer = window.setInterval(() => {
      if (!document.querySelector('nav[aria-label="Основная навигация"]')) return;
      window.clearInterval(timer);
      void prepare(showGuide);
    }, 60);
    return () => window.clearInterval(timer);
  }, [storageKey, prepare]);
  useEffect(() => {
    const element = dialog.current;
    if (!isOpen || !element) return;
    element.showModal();
    const overflow = document.body.style.overflow;
    const paddingBottom = document.body.style.paddingBottom;
    // Short pages also need enough scroll room to lift a full card above the guide.
    document.body.style.paddingBottom = `${parseFloat(getComputedStyle(document.body).paddingBottom) + 308}px`;
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = overflow; document.body.style.paddingBottom = paddingBottom; };
  }, [isOpen]);
  useEffect(() => {
    if (step === null || pathname !== destination) return;
    heading.current?.focus({ preventScroll: true });
    let target: HTMLElement | null = null;
    let lastSize = "";
    let fitted: HTMLElement | null = null;
    let fittedViewport = "";
    let originalZoom = "";
    let originalWidth = "";
    const restoreFit = () => {
      if (!fitted) return;
      fitted.style.zoom = originalZoom;
      fitted.style.width = originalWidth;
      fitted = null;
    };
    let frame = 0;
    const started = Date.now();
    const update = () => {
      if (!card.current) return;
      const candidates = [...document.querySelectorAll<HTMLElement>(`[data-tour="${steps[step].target}"]`)];
      let found = candidates.find(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0) ?? null;
      const missing = !found;
      // Allow remote data to arrive before explaining an unavailable feature.
      if (!found && Date.now() - started < 3000) return;
      if (!found) found = document.querySelector<HTMLElement>("#main h1, #main h2");
      if (!found) return;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const cardRect = card.current.getBoundingClientRect();
      const viewportKey = `${viewport.width}:${viewport.height}`;
      if (found !== fitted || viewportKey !== fittedViewport) {
        restoreFit();
        fitted = found;
        fittedViewport = viewportKey;
        originalZoom = found.style.zoom;
        originalWidth = found.style.width;
        const natural = found.getBoundingClientRect();
        const available = Math.max(120, viewport.height - cardRect.height - 48);
        // Fit long overviews in the available space while keeping their screen width.
        // Restore the original page sizing as soon as this step ends.
        if (steps[step].target === "issue-controls" && natural.height > available) {
          const scale = available / natural.height;
          found.style.zoom = String(scale);
          found.style.width = `${natural.width / scale}px`;
        }
      }
      const rect = found.getBoundingClientRect();
      const size = `${viewport.width}:${viewport.height}:${Math.round(cardRect.height)}:${Math.round(rect.height)}`;
      if (found !== target || size !== lastSize) {
        target = found;
        lastSize = size;
        const freeHeight = viewport.height - cardRect.height - 48;
        const desiredTop = Math.max(16, Math.min(80, (freeHeight - rect.height) / 2));
        const nextScroll = Math.max(0, window.scrollY + rect.top - desiredTop);
        window.scrollTo({ top: nextScroll, behavior: "instant" });
      }
      const next = { ...tourLayout(found.getBoundingClientRect(), viewport, cardRect), missing };
      setPosition(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    // Poll only during the guide: targets can arrive after navigation or data loading.
    const timer = window.setInterval(update, 150);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    update();
    return () => { restoreFit(); clearInterval(timer); cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule); };
  }, [step, pathname, destination]);
  function move(next: number) {
    const camera = document.querySelector('[data-tour="camera-card"]')?.closest("a");
    if (camera && /^\/cameras\/[1-9][0-9]*$/.test(camera.pathname)) cameraPath.current = camera.pathname;
    const href = steps[next].href === "camera" ? cameraPath.current : steps[next].href;
    setPosition(null);
    setDestination(href);
    setStep(next);
    router.replace(href, { scroll: false });
  }
  const current = step === null ? null : steps[step];
  const description = current && position?.missing
    ? "missing" in current ? current.missing : "Этот элемент пока недоступен. " + current.text
    : current?.text;
  return <Context value={{ start, activeTarget: current?.target ?? null }}><span hidden data-app-loading={issues.loading || messages.loading || utilities.loading} />{children}{isOpen && <dialog ref={dialog} className={styles.overlay} aria-labelledby={preparation ? "preparation-title" : "tour-title"} aria-describedby={preparation ? undefined : "tour-description"} onCancel={event => { event.preventDefault(); finish(); }}>
    {preparation ? <section className={styles.preparation}>
      <div className={styles.preparationMark} aria-hidden="true"><Icon name="home" size={36} /></div>
      <h2 id="preparation-title">Готовим ваш ДомПульс</h2><p>{preparation.error ?? "Загружаем разделы и фотографии, чтобы знакомство с домом прошло плавно."}</p>
      <progress max={preparation.total} value={preparation.done} aria-label="Подготовка разделов" />
      <span role="status">{preparation.error ? "Подготовка прервана" : `Готово разделов: ${preparation.done} из ${preparation.total}`}</span>
      {preparation.error && <button type="button" className={styles.next} onClick={() => void prepare(guideAfterPreparation.current)}>Попробовать снова</button>}
      {preparation.error && <button type="button" className={styles.back} onClick={finish}>Открыть приложение без подготовки</button>}
    </section> : current && <>
    {position ? <div aria-hidden="true" className={styles.spot} data-tour-spot={current.target} style={position.spot} /> : <div className={styles.shade} />}
    <section ref={card} data-compact={current.target === "plan-selection" || current.target === "plan-map" || undefined} className={styles.card} style={position?.card}>
      <div className={styles.top}><span>{step! + 1} из {steps.length} · {position ? "Коротко о главном" : "Открываем нужное место…"}</span><button type="button" onClick={finish} aria-label="Закрыть обучение" title="Пропустить обучение"><Icon name="close" size={17} /></button></div>
      <h2 id="tour-title" tabIndex={-1} ref={heading}>{current.title}</h2>
      <p id="tour-description">{description}</p>
      <footer><button type="button" className={styles.back} onClick={finish}>Пропустить</button><div>{step! > 0 && <button type="button" className={styles.back} onClick={() => move(step! - 1)} aria-label="Предыдущая подсказка"><Icon name="arrow" size={16} style={{ transform: "rotate(180deg)" }} /></button>}<button type="button" disabled={!position} className={styles.next} onClick={() => step === steps.length - 1 ? finish() : move(step! + 1)}>{step === steps.length - 1 ? "Готово" : "Далее"}<Icon name="arrow" size={15} /></button></div></footer>
      <div className={styles.progress} aria-label={`Шаг ${step! + 1} из ${steps.length}`}><span style={{ width: `${(step! + 1) / steps.length * 100}%` }} /></div>
    </section>
    </>}
  </dialog>}</Context>;
}
