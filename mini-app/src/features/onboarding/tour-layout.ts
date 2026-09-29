export type TourRect = { left: number; top: number; width: number; height: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export function tourLayout(target: TourRect, viewport: { width: number; height: number }, card: { width: number; height: number }) {
  const margin = 12;
  const mobile = viewport.width <= 760;
  const bottom = viewport.height - margin;
  const width = Math.min(card.width, viewport.width - margin * 2);
  const height = Math.min(card.height, bottom - margin);
  let left = clamp(target.left, margin, viewport.width - width - margin);
  let top = bottom - height;
  if (!mobile) {
    if (target.left + target.width + 20 + width <= viewport.width - margin) {
      left = target.left + target.width + 20;
      top = clamp(target.top, margin, bottom - height);
    } else if (target.left - width - 20 >= margin) {
      left = target.left - width - 20;
      top = clamp(target.top, margin, bottom - height);
    } else if (target.top + target.height + 20 + height <= bottom) {
      top = target.top + target.height + 20;
    } else if (target.top - height - 20 >= margin) {
      top = target.top - height - 20;
    }
  } else {
    left = (viewport.width - width) / 2;
    if (target.top + target.height + 16 > top && target.top - height - 20 >= margin) {
      top = target.top - height - 20;
    }
  }
  const x = clamp(target.left - 6, 4, viewport.width - 4);
  const y = clamp(target.top - 6, 4, viewport.height - 4);
  return {
    card: { left, top },
    spot: { left: x, top: y, width: Math.max(0, Math.min(target.left + target.width + 6, viewport.width - 4) - x), height: Math.max(0, Math.min(target.top + target.height + 6, bottom) - y) },
  };
}
