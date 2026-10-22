export type TourRect = { left: number; top: number; width: number; height: number };
export type TourViewport = { width: number; height: number; left?: number; top?: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export function tourLayout(target: TourRect, viewport: TourViewport, card: { width: number; height: number }, bottomInset = viewport.width <= 760 ? 78 : 0, options?: { placement: "above"; guideHeight: number; topInset?: number }) {
  const margin = 12;
  const originX = viewport.left ?? 0;
  const originY = viewport.top ?? 0;
  const width = Math.min(card.width, viewport.width - margin * 2);
  const height = Math.min(card.height, Math.max(0, viewport.height - bottomInset - margin * 2));
  const left = originX + (viewport.width - width) / 2;
  const lowestTop = originY + viewport.height - bottomInset - height - margin;
  const top = options ? clamp(target.top - height - options.guideHeight - 56, Math.min(originY + (options.topInset ?? margin), lowestTop), lowestTop) : lowestTop;
  const x = clamp(target.left - 8, originX + 4, originX + viewport.width - 4);
  const y = clamp(target.top - 8, originY + 4, originY + viewport.height - 4);
  const right = clamp(target.left + target.width + 8, x, originX + viewport.width - 4);
  const overlapsCard = right > left - 12 && x < left + width + 12;
  const bottom = !options && overlapsCard ? top - 12 : originY + viewport.height - bottomInset - margin;
  return {
    card: { left, top },
    spot: { left: x, top: y, width: right - x, height: Math.max(0, Math.min(target.top + target.height + 8, bottom) - y) },
  };
}
