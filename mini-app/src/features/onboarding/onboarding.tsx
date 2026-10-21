"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Zhorik } from "@/shared/ui/zhorik";
import { nextTourIndex } from "./tour-navigation";
import { StartupScreen } from "@/shared/ui/startup-screen";
import { Icon } from "@/shared/ui/icon";
import { tourSteps as steps } from "./steps";
import { tourLayout, type TourRect } from "./tour-layout";
import styles from "./onboarding.module.css";
import { prepareTour } from "./prepare";
import { useIssues } from "@/entities/issue";
import { useMessages } from "@/entities/message";
import { useUtilityAccount } from "@/entities/utilities";

const Context = createContext<{ start: () => void; activeTarget: string | null; preparing: boolean }>({ start: () => {}, activeTarget: null, preparing: false });
export const useOnboarding = () => useContext(Context);
type Position = { spot: TourRect; card: { left: number; top: number } };

export function OnboardingProvider({ userId, children, deferAutomatic = false }: { userId: number; children: ReactNode; deferAutomatic?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const initialPath = useRef(pathname);
  const [step, setStep] = useState<number | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [preparation, setPreparation] = useState<{ percent: number; error?: string } | null>({ percent: 0 });
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
  const storageKey = `dompulse:onboarding:registration:v2:${userId}`;
  const prepare = useCallback(async (showGuide: boolean) => {
    guideAfterPreparation.current = showGuide;
    if (!preparationRun.current) returnTo.current = window.location.pathname + window.location.search;
    preparationRun.current?.abort();
    const controller = new AbortController();
    preparationRun.current = controller;
    setStep(null);
    setExcluded([]);
    setPosition(null);
    setPreparation({ percent: 0 });
    try {
      await prepareGuideImages(controller.signal);
      cameraPath.current = await prepareTour(router, controller.signal, percent => setPreparation({ percent }), showGuide ? "/" : returnTo.current);
      await finishPreparation(controller.signal);
      if (controller.signal.aborted) return;
      prepared.current = true;
      preparationRun.current = null;
      setPreparation(null);
      if (showGuide) {
        setDestination("/");
        setStep(0);
        try { localStorage.setItem(storageKey, "done"); } catch {}
      }
    } catch (error) {
      if (!controller.signal.aborted) setPreparation(previous => ({ percent: previous?.percent ?? 0, error: error instanceof Error ? error.message : "Не удалось подготовить разделы" }));
    }
  }, [router, storageKey]);
  const start = useCallback(() => {
    if (!prepared.current) { void prepare(true); return; }
    returnTo.current = window.location.pathname + window.location.search;
    setPosition(null);
    setDestination("/");
    setExcluded([]);
    setStep(0);
    router.replace("/", { scroll: false });
  }, [prepare, router]);
  useEffect(() => () => preparationRun.current?.abort(), []);
  const finish = useCallback(() => {
    preparationRun.current?.abort();
    preparationRun.current = null;
    setPreparation(null);
    try { localStorage.setItem(storageKey, "done"); } catch {}
    setStep(null);
    setPosition(null);
    router.replace(returnTo.current, { scroll: true });
  }, [router, storageKey]);
  useEffect(() => {
    // A house invitation must finish at its requested section, including after registration.
    // The resident can still start the guide manually from More.
    let showGuide = !deferAutomatic && initialPath.current !== "/invite";
    try { showGuide = showGuide && localStorage.getItem(storageKey) !== "done"; } catch {}
    const timer = window.setInterval(() => {
      if (!document.querySelector("#main")) return;
      // The initial issue may still be resolving its house. Starting the tour
      // now would navigate away before the house switch captures the return URL.
      if (document.querySelector('#main .request-state[aria-busy="true"]')) return;
      window.clearInterval(timer);
      void prepare(showGuide);
    }, 60);
    return () => window.clearInterval(timer);
  }, [storageKey, prepare, deferAutomatic]);
  useEffect(() => {
    const element = dialog.current;
    if (!isOpen || !element) return;
    element.showModal();
    const overflow = document.body.style.overflow;
    const paddingBottom = document.body.style.paddingBottom;
    document.body.style.paddingBottom = `${parseFloat(getComputedStyle(document.body).paddingBottom) + 430}px`;
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = overflow; document.body.style.paddingBottom = paddingBottom; };
  }, [isOpen]);
  const move = useCallback((next: number) => {
    const camera = document.querySelector('[data-tour="camera-card"]')?.closest("a");
    if (camera && /^\/cameras\/[1-9][0-9]*$/.test(camera.pathname)) cameraPath.current = camera.pathname;
    const href = steps[next].href === "camera" ? cameraPath.current : steps[next].href;
    setPosition(null);
    setDestination(href);
    setStep(next);
    router.replace(href, { scroll: false });
  }, [router]);
  useEffect(() => {
    if (step === null || pathname !== destination) return;
    let target: HTMLElement | null = null;
    let lastSize = "";
    let fitted: HTMLElement | null = null;
    let fittedViewport = "";
    let originalZoom = "";
    let originalWidth = "";
    let originalMaxHeight = "";
    let originalOverflow = "";
    const restoreFit = () => {
      if (!fitted) return;
      fitted.style.zoom = originalZoom;
      fitted.style.width = originalWidth;
      fitted.style.maxHeight = originalMaxHeight;
      fitted.style.overflowY = originalOverflow;
      fitted = null;
    };
    let frame = 0;
    const started = Date.now();
    const update = () => {
      if (!card.current) return;
      const candidates = [...document.querySelectorAll<HTMLElement>(`[data-tour="${steps[step].target}"]`)];
      const found = candidates.find(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0) ?? null;
      if (!found) {
        if (Date.now() - started < 1800 || document.querySelector('#main [aria-busy="true"]')) return;
        const unavailable = [...excluded, steps[step].target];
        setExcluded(unavailable);
        const next = nextTourIndex(steps, step, 1, unavailable);
        if (next === null) finish(); else move(next);
        return;
      }
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const guideHeight = card.current.previousElementSibling?.getBoundingClientRect().height ?? 0;
      const above = !!steps[step].guide;
      const cardRect = card.current.getBoundingClientRect();
      const navigationHeight = document.querySelector('nav[aria-label="Основная навигация"]')?.getBoundingClientRect().height ?? 78;
      const viewportKey = `${viewport.width}:${viewport.height}`;
      if (found !== fitted || viewportKey !== fittedViewport) {
        restoreFit();
        fitted = found;
        fittedViewport = viewportKey;
        originalZoom = found.style.zoom;
        originalWidth = found.style.width;
        originalMaxHeight = found.style.maxHeight;
        originalOverflow = found.style.overflowY;
        const natural = found.getBoundingClientRect();
        const available = Math.max(120, viewport.height - cardRect.height - navigationHeight - 48 - (steps[step].target === "utility-bill" ? guideHeight : 0));
        if (steps[step].target === "message-panel") {
          found.style.maxHeight = `${Math.max(120, available - guideHeight)}px`;
          found.style.overflowY = "auto";
        }
        if (steps[step].target === "issue-location") {
          const room = Math.max(120, viewport.height - cardRect.height - 100);
          if (natural.height > room) {
            const scale = room / natural.height;
            found.style.zoom = String(scale);
            found.style.width = `${natural.width / scale}px`;
          }
        }
        if (["issue-controls", "plan-map", "utility-bill"].includes(steps[step].target) && natural.height > available) {
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
        if (above) {
          const bottom = viewport.height - navigationHeight - 16;
          const headroom = cardRect.height + (steps[step].guide === "hanging" ? guideHeight : 0) + 32;
          if (steps[step].target === "camera-report") {
            window.scrollTo({ top: 0, behavior: "instant" });
            const cameraButton = found.getBoundingClientRect();
            if (cameraButton.bottom > bottom) window.scrollBy({ top: cameraButton.bottom - bottom, behavior: "instant" });
          } else if (rect.bottom > bottom) window.scrollBy({ top: rect.bottom - bottom, behavior: "instant" });
          else if (rect.top < headroom) window.scrollBy({ top: rect.top - headroom, behavior: "instant" });
        } else {
          const freeHeight = viewport.height - cardRect.height - navigationHeight - 48;
          const desiredTop = Math.max(16, Math.min(80, (freeHeight - rect.height) / 2));
          const nextScroll = Math.max(0, window.scrollY + rect.top - desiredTop);
          window.scrollTo({ top: nextScroll, behavior: "instant" });
        }
      }
      const next = tourLayout(found.getBoundingClientRect(), viewport, cardRect, navigationHeight, above ? { placement: "above", guideHeight: steps[step].guide === "hanging" ? guideHeight : 0, topInset: steps[step].guide === "inset" ? guideHeight + 4 : undefined } : undefined);
      setPosition(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    const timer = window.setInterval(update, 150);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    update();
    return () => { restoreFit(); clearInterval(timer); cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule); };
  }, [step, pathname, destination, excluded, finish, move]);
  const current = step === null ? null : steps[step];
  const visibleSteps = steps.filter(item => !excluded.includes(item.target));
  const visibleIndex = visibleSteps.findIndex(item => item.target === current?.target);
  const previousStep = step === null ? null : nextTourIndex(steps, step, -1, excluded);
  const nextStep = step === null ? null : nextTourIndex(steps, step, 1, excluded);
  const ready = position !== null && pathname === destination;
  useEffect(() => { if (ready) heading.current?.focus({ preventScroll: true }); }, [ready, step]);
  return <Context value={{ start, activeTarget: current?.target ?? null, preparing: preparation !== null }}><span hidden data-app-loading={issues.loading || messages.loading || utilities.loading} />{children}{isOpen && <dialog ref={dialog} className={styles.overlay} aria-labelledby={preparation ? "preparation-title" : "tour-title"} aria-describedby={preparation ? undefined : "tour-description"} onCancel={event => { event.preventDefault(); finish(); }}>
    {preparation ? <StartupScreen percent={preparation.percent} error={preparation.error}
      complete={preparation.percent === 100 && !preparation.error}
      status={preparation.percent === 100 ? "Всё готово" : `Загрузка · ${Math.round(preparation.percent)}%`}
      actions={preparation.error ? <><button type="button" onClick={() => void prepare(guideAfterPreparation.current)}>Попробовать снова</button><button type="button" onClick={finish}>Открыть приложение без подготовки</button></> : undefined}
    /> : current && <>
    {position ? <div aria-hidden="true" className={styles.spot} data-tour-spot={current.target} style={position.spot} /> : <div className={styles.shade} />}
    <div key={current.target} className={styles.panel} data-ready={ready} data-guide={current.guide} style={position?.card}>
      <Zhorik pose={current.pose} mirrored={current.side === "right" && current.pose === "point"} className={`${styles.guide} ${current.side === "right" ? styles.guideRight : ""}`} />
    <section ref={card} className={styles.card}>
      <div className={styles.top}><span>Подсказка {visibleIndex + 1} из {visibleSteps.length}</span><button type="button" onClick={finish} aria-label="Закрыть обучение" title="Пропустить обучение"><Icon name="close" size={17} /></button></div>
      <div className={styles.segments} role="progressbar" aria-valuemin={1} aria-valuemax={visibleSteps.length} aria-valuenow={visibleIndex + 1} aria-label={`Шаг ${visibleIndex + 1} из ${visibleSteps.length}`}>{visibleSteps.map((item, index) => <span key={item.target} data-filled={index <= visibleIndex || undefined} />)}</div>
      <h2 id="tour-title" tabIndex={-1} ref={heading}>{current.title}</h2>
      <p id="tour-description">{current.text}</p>
      <footer><button type="button" className={styles.back} onClick={finish}>Пропустить</button><div>{previousStep !== null && <button type="button" className={styles.back} onClick={() => move(previousStep!)} aria-label="Предыдущая подсказка"><Icon name="arrow" size={16} style={{ transform: "rotate(180deg)" }} /></button>}<button type="button" disabled={!ready} className={styles.next} onClick={() => nextStep === null ? finish() : move(nextStep)}>{nextStep === null ? "Готово" : "Далее"}<Icon name="arrow" size={15} /></button></div></footer>
    </section>
    </div>
    </>}
  </dialog>}</Context>;
}

function finishPreparation(signal: AbortSignal) {
  signal.throwIfAborted();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const abort = () => { window.clearTimeout(timer); reject(new DOMException("Подготовка отменена", "AbortError")); };
    const timer = window.setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 500);
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function prepareGuideImages(signal: AbortSignal) {
  await Promise.all(["point", "rest", "open", "peek", "hanging"].map(async name => {
    signal.throwIfAborted();
    const image = new window.Image();
    image.src = `/images/zhorik/${name}.png`;
    try { await image.decode(); } catch { throw new Error("Не удалось загрузить иллюстрации обучения. Повторите попытку."); }
    signal.throwIfAborted();
  }));
}
