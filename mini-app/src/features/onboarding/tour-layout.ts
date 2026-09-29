export type TourRect = { left: number; top: number; width: number; height: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export function tourLayout(target: TourRect, viewport: { width: number; height: number }, card: { width: number; height: number }) {
  const margin = 12;
  const width = Math.min(card.width, viewport.width - margin * 2);
  const height = Math.min(card.height, viewport.height - margin * 2);
  const left = viewport.width <= 760 ? (viewport.width - width) / 2 : viewport.width - width - margin;
  const top = viewport.height - height - margin;
  const x = clamp(target.left - 8, 4, viewport.width - 4);
  const y = clamp(target.top - 8, 4, viewport.height - 4);
  const right = clamp(target.left + target.width + 8, x, viewport.width - 4);
  const overlapsCard = right > left - 12 && x < left + width + 12;
  const bottom = overlapsCard ? top - 12 : viewport.height - margin;
  return {
    card: { left, top },
    spot: { left: x, top: y, width: right - x, height: Math.max(0, Math.min(target.top + target.height + 8, bottom) - y) },
  };
}
