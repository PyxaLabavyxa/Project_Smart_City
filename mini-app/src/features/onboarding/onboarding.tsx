"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Zhorik } from "@/shared/ui/zhorik";
import { nextTourIndex } from "./tour-navigation";
import { StartupScreen } from "@/shared/ui/startup-screen";
import { Icon } from "@/shared/ui/icon";
import { tourSteps as steps } from "./steps";
import { tourFocusRange, tourLayout, tourNeedsCompact, tourScrollTop, tourSidePlacement, type TourRect } from "./tour-layout";
import styles from "./onboarding.module.css";
import { prepareTourImages } from "./prepare";

type Position = { spot: TourRect; card: { left: number; top: number }; settled: boolean; scrollable: boolean; compact: boolean };

export function OnboardingTour({ onStateChange, onFinish }: { onStateChange: (target: string | null, preparing: boolean) => void; onFinish: (result: "completed" | "skipped") => Promise<void> }) {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<number | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [preparation, setPreparation] = useState<{ percent: number; error?: string } | null>({ percent: 0 });
  const preparationRun = useRef<AbortController | null>(null);
  const [destination, setDestination] = useState("/");
  const [position, setPosition] = useState<Position | null>(null);
  const cameraPath = useRef("/cameras");
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnTo = useRef("/");
  const focusRegion = useRef<{ element: HTMLElement; top: number; bottom: number } | null>(null);
  const touchY = useRef<number | null>(null);
  const isOpen = step !== null || preparation !== null;
  const prepare = useCallback(() => {
    returnTo.current = window.location.pathname + window.location.search;
    preparationRun.current?.abort();
    const controller = new AbortController(); preparationRun.current = controller;
    return prepareTourImages(steps.map(step => step.pose), controller.signal, percent => setPreparation(previous => previous?.percent === percent && !previous.error ? previous : { percent })).then(() => {
      if (controller.signal.aborted) return;
      preparationRun.current = null;
      onStateChange(steps[0].target, false);
      setPreparation(null); setDestination("/"); setStep(0);
      router.replace("/", { scroll: false });
    }, () => {
      if (!controller.signal.aborted) {
        controller.abort();
        setPreparation(previous => ({ percent: previous?.percent ?? 0, error: "Не удалось загрузить картинки Жорика. Повторите попытку." }));
      }
    });
  }, [router, onStateChange]);
  useEffect(() => { void prepare(); return () => preparationRun.current?.abort(); }, [prepare]);
  const finish = useCallback((result: "completed" | "skipped" = "skipped") => {
    preparationRun.current?.abort(); preparationRun.current = null;
    setPreparation(null); setStep(null); setPosition(null);
    onStateChange(null, false);
    void onFinish(result); router.replace(returnTo.current, { scroll: true });
  }, [router, onFinish, onStateChange]);
  useEffect(() => {
    const element = dialog.current;
    if (!isOpen || !element) return;
    element.showModal();
    const overflow = document.body.style.overflow;
    const paddingBottom = document.body.style.paddingBottom;
    document.documentElement.dataset.tourActive = "true";
    document.body.style.paddingBottom = `${parseFloat(getComputedStyle(document.body).paddingBottom) + 430}px`;
    document.body.style.overflow = "hidden";
    return () => { element.close(); delete document.documentElement.dataset.tourActive; document.body.style.overflow = overflow; document.body.style.paddingBottom = paddingBottom; };
  }, [isOpen]);
  const move = useCallback((next: number) => {
    const camera = document.querySelector('[data-tour="camera-card"]')?.closest("a");
    if (camera && /^\/cameras\/[1-9][0-9]*$/.test(camera.pathname)) cameraPath.current = camera.pathname;
    const href = steps[next].href === "camera" ? cameraPath.current : steps[next].href;
    setPosition(null);
    onStateChange(steps[next].target, false);
    setDestination(href);
    setStep(next);
    router.replace(href, { scroll: false });
  }, [router, onStateChange]);
  useEffect(() => {
    if (step === null || pathname !== destination) return;
    let observed: HTMLElement | null = null;
    let lastGeometry = "";
    let frame = 0;
    let waitTimer: ReturnType<typeof setTimeout> | undefined;
    let scrolling = false;
    let scrollDestination = 0;
    let scrollDeadline = 0;
    let normalCardHeight = 0;
    let measuredViewport = "";
    const started = performance.now();
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    const update = () => {
      frame = 0;
      if (!card.current) return;
      const found = [...document.querySelectorAll<HTMLElement>(`[data-tour="${steps[step].target}"]`)]
        .find(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0);
      if (!found) {
        if (performance.now() - started < 1800 || document.querySelector('#main [aria-busy="true"]')) {
          waitTimer = setTimeout(schedule, 100);
          return;
        }
        const unavailable = [...excluded, steps[step].target];
        setExcluded(unavailable);
        const next = nextTourIndex(steps, step, 1, unavailable);
        if (next === null) finish("completed"); else move(next);
        return;
      }
      const visible = window.visualViewport;
      const viewport = {
        width: Math.min(window.innerWidth, visible?.width ?? window.innerWidth),
        height: Math.min(window.innerHeight, visible?.height ?? window.innerHeight),
        left: visible?.offsetLeft ?? 0, top: visible?.offsetTop ?? 0,
      };
      const panel = card.current.parentElement;
      panel?.style.setProperty("--tour-width", `${Math.min(440, viewport.width - 24)}px`);
      panel?.style.setProperty("--tour-height", `${viewport.height}px`);
      const navigationRect = document.querySelector('#main + nav')?.getBoundingClientRect();
      const navigationHeight = navigationRect && navigationRect.top > viewport.height / 2 ? navigationRect.height : 0;
      const viewportKey = `${viewport.width}:${viewport.height}:${viewport.left}:${viewport.top}`;
      const adaptiveHint = !steps[step].guide;
      const besideEligible = viewport.width >= 768 && (!steps[step].guide || !!found.closest('dialog[data-tour-preview]'));
      if ((adaptiveHint || besideEligible) && measuredViewport !== viewportKey) {
        panel?.removeAttribute("data-compact");
        card.current.style.maxHeight = "none";
        card.current.style.minHeight = "220px";
        normalCardHeight = card.current.getBoundingClientRect().height;
        measuredViewport = viewportKey;
      }
      const beside = besideEligible ? tourSidePlacement(found.getBoundingClientRect(), viewport, normalCardHeight, navigationHeight) : null;
      if (beside) panel?.style.setProperty("--tour-width", `${beside.width}px`);
      const compact = !beside && adaptiveHint && tourNeedsCompact(viewport, found.getBoundingClientRect().height, normalCardHeight, navigationHeight);
      panel?.toggleAttribute("data-compact", compact);
      const artworkHeight = card.current.previousElementSibling?.getBoundingClientRect().height ?? 0;
      const sideGuide = steps[step].target === "issue-location" && matchMedia("(min-width:900px) and (max-height:850px)").matches;
      const guideHeight = (adaptiveHint && !beside) || sideGuide ? 0 : artworkHeight;
      const above = !!steps[step].guide && !matchMedia("(min-width:768px)").matches;
      const focusSpace = beside ? 0 : Math.min(96, found.getBoundingClientRect().height);
      const maxCardHeight = Math.max(80, viewport.height - navigationHeight - guideHeight - focusSpace - 28);
      card.current.style.maxHeight = `${maxCardHeight}px`;
      card.current.style.minHeight = compact ? "0px" : `${Math.min(220, maxCardHeight)}px`;
      const cardRect = card.current.getBoundingClientRect();
      const options = beside ? { placement: "beside" as const, side: beside.side, guideHeight } : above ? { placement: "above" as const, guideHeight: steps[step].guide === "hanging" ? guideHeight : 0, topInset: steps[step].guide === "inset" ? guideHeight + 4 : undefined } : undefined;
      const layout = tourLayout(found.getBoundingClientRect(), viewport, cardRect, navigationHeight, options);
      let range = beside ? { top: viewport.top + 16, bottom: viewport.top + viewport.height - navigationHeight - 16 } : tourFocusRange(viewport, { top: layout.card.top, height: cardRect.height }, above ? options!.guideHeight : guideHeight, navigationHeight, above, adaptiveHint ? 10 : 16);
      if (above && found.getBoundingClientRect().height > range.bottom - range.top) {
        range = tourFocusRange(viewport, { top: layout.card.top, height: cardRect.height }, 0, navigationHeight, true);
      }
      if (adaptiveHint && !beside) {
        const clearOfGuide = tourFocusRange(viewport, { top: layout.card.top, height: cardRect.height }, artworkHeight, navigationHeight, false);
        if (found.getBoundingClientRect().height <= clearOfGuide.bottom - clearOfGuide.top) range = clearOfGuide;
      }
      focusRegion.current = { element: found, ...range };
      if (found !== observed) {
        observer.disconnect();
        observed = found;
        observer.observe(found);
        observer.observe(card.current);
      }
      const rect = found.getBoundingClientRect();
      const geometry = `${viewportKey}:${Math.round(cardRect.height)}:${Math.round(rect.height)}`;
      if (geometry !== lastGeometry) {
        lastGeometry = geometry;
        // Fixed controls and the report sheet do not move with document scrolling.
        let fixed = !!found.closest("dialog");
        const sheet = found.closest("dialog");
        if (sheet) sheet.scrollTop = tourScrollTop(rect, sheet.scrollTop, range);
        for (let node: HTMLElement | null = found; node && !fixed; node = node.parentElement) fixed = getComputedStyle(node).position === "fixed";
        const top = fixed ? window.scrollY : tourScrollTop(rect, window.scrollY, range);
        if (Math.abs(top - window.scrollY) > 1) {
          const immediate = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motionInput === "keyboard";
          scrolling = !immediate;
          scrollDestination = Math.min(top, Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
          scrollDeadline = performance.now() + 1500;
          window.scrollTo({ top, behavior: immediate ? "instant" : "smooth" });
        }
      }
      if (scrolling) {
        const destination = Math.min(scrollDestination, Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
        if (Math.abs(window.scrollY - destination) < 1 || performance.now() >= scrollDeadline) scrolling = false;
        else schedule();
      }
      const nextLayout = tourLayout(found.getBoundingClientRect(), viewport, cardRect, navigationHeight, options, beside ? undefined : range);
      const next = { ...nextLayout, settled: !scrolling, scrollable: rect.height > range.bottom - range.top, compact };
      setPosition(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    // Let the target's context-driven filters, tabs and preview sheet commit first.
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(update); });
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      clearTimeout(waitTimer); cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule); window.visualViewport?.removeEventListener("scroll", schedule);
      if (scrolling) window.scrollTo({ top: window.scrollY, behavior: "instant" });
      focusRegion.current = null;
    };
  }, [step, pathname, destination, excluded, finish, move]);
  const scrollTarget = (delta: number) => {
    const focus = focusRegion.current;
    if (!focus) return;
    const rect = focus.element.getBoundingClientRect();
    if (rect.height <= focus.bottom - focus.top) return;
    const distance = delta > 0 ? Math.min(delta, Math.max(0, rect.bottom - focus.bottom)) : Math.max(delta, Math.min(0, rect.top - focus.top));
    const sheet = focus.element.closest("dialog");
    if (sheet) sheet.scrollTop += distance;
    else window.scrollBy({ top: distance, behavior: "instant" });
  };
  const current = step === null ? null : steps[step];
  const visibleSteps = steps.filter(item => !excluded.includes(item.target));
  const visibleIndex = visibleSteps.findIndex(item => item.target === current?.target);
  const previousStep = step === null ? null : nextTourIndex(steps, step, -1, excluded);
  const nextStep = step === null ? null : nextTourIndex(steps, step, 1, excluded);
  const visible = position !== null && pathname === destination;
  const ready = visible && position.settled;
  useEffect(() => { if (ready) heading.current?.focus({ preventScroll: true }); }, [ready, step]);
  return isOpen ? <dialog ref={dialog} className={styles.overlay} data-motion="none" aria-labelledby={preparation ? "preparation-title" : "tour-title"} aria-describedby={preparation ? undefined : "tour-description"} onCancel={event => { event.preventDefault(); finish(); }}
    onWheel={event => { if (!(event.target as Element).closest(`.${styles.panel}`)) scrollTarget(event.deltaY); }}
    onTouchStart={event => { touchY.current = (event.target as Element).closest(`.${styles.panel}`) ? null : event.touches[0].clientY; }}
    onTouchMove={event => { if (touchY.current === null) return; const y = event.touches[0].clientY; scrollTarget(touchY.current - y); touchY.current = y; }}
    onTouchEnd={() => { touchY.current = null; }}
    onKeyDown={event => { const delta = { ArrowDown: 48, ArrowUp: -48, PageDown: 200, PageUp: -200 }[event.key]; if (delta && position?.scrollable) { event.preventDefault(); scrollTarget(delta); } }}>

    {preparation ? <StartupScreen percent={preparation.percent} error={preparation.error}
      complete={preparation.percent === 100 && !preparation.error}
      status={preparation.percent === 100 ? "Всё готово" : `Загрузка · ${Math.round(preparation.percent)}%`}
      actions={preparation.error ? <><button type="button" onClick={() => { setPreparation({ percent: 0 }); void prepare(); }}>Попробовать снова</button><button type="button" onClick={() => finish()}>Открыть приложение без подготовки</button></> : undefined}
    /> : current && <>
    {position ? <div aria-hidden="true" className={styles.spot} data-tour-spot={current.target} style={position.spot} /> : <div className={styles.shade} />}
    <div key={current.target} className={styles.panel} data-target={current.target} data-ready={visible} data-guide={current.guide} data-scrollable={position?.scrollable || undefined} data-compact={position?.compact || undefined} style={position?.card}>
      <Zhorik pose={current.pose} mirrored={current.side === "right" && current.pose === "point"} className={`${styles.guide} ${current.side === "right" ? styles.guideRight : ""}`} />
    <section ref={card} className={styles.card}>
      <div className={styles.top}><span className={styles.stepLabel}>Подсказка {visibleIndex + 1} из {visibleSteps.length}</span><span className={styles.compactLabel}>{visibleIndex + 1}/{visibleSteps.length} · {current.title}</span><button type="button" onClick={() => finish()} aria-label="Закрыть обучение" title="Пропустить обучение"><Icon name="close" size={17} /></button></div>
      <div className={styles.segments} role="progressbar" aria-valuemin={1} aria-valuemax={visibleSteps.length} aria-valuenow={visibleIndex + 1} aria-label={`Шаг ${visibleIndex + 1} из ${visibleSteps.length}`}>{visibleSteps.map((item, index) => <span key={item.target} data-filled={index <= visibleIndex || undefined} />)}</div>
      <h2 id="tour-title" tabIndex={-1} ref={heading}>{current.title}</h2>
      <p id="tour-description" className={styles.description}>{current.text}</p>
      {position?.scrollable && <p className={styles.scrollHint}>Прокрутите выделенный блок</p>}
      <footer><button type="button" className={styles.back} onClick={() => finish()}>Пропустить</button><div>{previousStep !== null && <button type="button" className={styles.back} onClick={() => move(previousStep!)} aria-label="Предыдущая подсказка"><Icon name="arrow" size={16} style={{ transform: "rotate(180deg)" }} /></button>}<button type="button" disabled={!ready} className={styles.next} onClick={() => nextStep === null ? finish("completed") : move(nextStep)}>{nextStep === null ? "Готово" : "Далее"}<Icon name="arrow" size={15} /></button></div></footer>
    </section>
    </div>
    </>}
  </dialog> : null;
}
