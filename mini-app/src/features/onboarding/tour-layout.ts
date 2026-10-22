export type TourRect = { left: number; top: number; width: number; height: number };
export type TourViewport = { width: number; height: number; left?: number; top?: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** Compact only when the normal hint and the unscaled target cannot fit together. */
export function tourNeedsCompact(viewport: TourViewport, targetHeight: number, normalCardHeight: number, bottomInset: number) {
  return targetHeight + normalCardHeight + bottomInset + 32 > viewport.height;
}

export function tourLayout(target: TourRect, viewport: TourViewport, card: { width: number; height: number }, bottomInset = viewport.width <= 760 ? 78 : 0, options?: { placement: "above"; guideHeight: number; topInset?: number }) {
  const margin = 12;
  const originX = viewport.left ?? 0;
  const originY = viewport.top ?? 0;
  const width = Math.min(card.width, viewport.width - margin * 2);
  const height = Math.min(card.height, Math.max(0, viewport.height - bottomInset - margin * 2));
  const left = originX + (viewport.width - width) / 2;
  const lowestTop = originY + viewport.height - bottomInset - height - margin;
  const top = options ? Math.min(originY + (options.topInset ?? margin), lowestTop) : lowestTop;
  const x = clamp(target.left - 8, originX + 4, originX + viewport.width - 4);
  const y = clamp(target.top - 8, originY + 4, originY + viewport.height - 4);
  const right = clamp(target.left + target.width + 8, x, originX + viewport.width - 4);
  const bottom = originY + viewport.height - bottomInset - margin;
  return {
    card: { left, top },
    spot: { left: x, top: y, width: right - x, height: Math.max(0, Math.min(target.top + target.height + 8, bottom) - y) },
  };
}

/** Space left for the highlighted control after reserving the guide and its card. */
export function tourFocusRange(viewport: TourViewport, card: { top: number; height: number }, guideHeight: number, bottomInset: number, above: boolean, gap = 16) {
  return above
    ? { top: card.top + card.height + guideHeight + gap, bottom: (viewport.top ?? 0) + viewport.height - bottomInset - gap }
    : { top: (viewport.top ?? 0) + gap, bottom: card.top - guideHeight - gap };
}

/** Keep an already visible target still; otherwise move only as far as necessary. */
export function tourScrollTop(target: TourRect, scrollY: number, range: { top: number; bottom: number }) {
  const delta = target.top < range.top || target.height > range.bottom - range.top
    ? target.top - range.top
    : Math.max(0, target.top + target.height - range.bottom);
  return Math.max(0, scrollY + delta);
}
