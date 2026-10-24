import test from 'node:test';
import assert from 'node:assert/strict';
import { tourBounds, tourFocusRange, tourLayout, tourNeedsCompact, tourScrollTop, tourSidePlacement } from '../src/features/onboarding/tour-layout.ts';

test('short wide screens put the hint beside the full target when a column fits', () => {
  const viewport = { width: 1024, height: 600 };
  const target = { left: 116, top: 16, width: 514, height: 498 };
  const side = tourSidePlacement(target, viewport, 245, 0);
  assert.deepEqual(side, { side: 'right', width: 366 });
  const layout = tourLayout(target, viewport, { width: side.width, height: 270 }, 0, { placement: 'beside', side: side.side, guideHeight: 100 });
  assert(layout.card.left > layout.spot.left + layout.spot.width);
  assert(layout.card.left + side.width <= viewport.width - 12);
  assert(layout.card.top >= 112);
  assert(layout.card.top + 270 <= viewport.height - 12);
  assert.equal(layout.spot.height, target.height + 24);
  assert.equal(tourSidePlacement(target, { width: 393, height: 851 }, 245, 74), null);
  assert.equal(tourSidePlacement(target, { width: 1024, height: 1000 }, 245, 0), null);
  assert.equal(tourSidePlacement({ ...target, width: 820 }, viewport, 245, 0), null);
  const opposite = tourSidePlacement({ ...target, left: 500, width: 400 }, viewport, 245, 0);
  assert.equal(opposite.side, 'left');
});

test('normal hints are kept when the target fits, compact hints follow available space', () => {
  assert.equal(tourNeedsCompact({ width: 393, height: 851 }, 400, 280, 74), false);
  assert.equal(tourNeedsCompact({ width: 393, height: 700 }, 400, 280, 74), true);
  assert.equal(tourNeedsCompact({ width: 1440, height: 600 }, 300, 280, 0), true);
  assert.equal(tourNeedsCompact({ width: 320, height: 1000 }, 400, 280, 74), false);
  assert.equal(tourNeedsCompact({ width: 393, height: 786 }, 400, 280, 74), false);
});

test('a normal bill hint uses the remaining space before collapsing its heading', () => {
  const viewport = { width: 393, height: 851 };
  const targetHeight = 498.453125, cardHeight = 244.875, navigationHeight = 74.125;
  assert.equal(tourNeedsCompact(viewport, targetHeight, cardHeight, navigationHeight), false);
  assert.equal(tourNeedsCompact({ ...viewport, height: 700 }, targetHeight, cardHeight, navigationHeight), true);
  const { card } = tourLayout({ left: 16, top: 30, width: 361, height: targetHeight }, viewport, { width: 369, height: cardHeight }, navigationHeight);
  const range = tourFocusRange(viewport, { ...card, height: cardHeight }, 0, navigationHeight, false, 10);
  assert(range.bottom - range.top >= targetHeight);
});

test('tour fits the visible viewport when iOS browser chrome offsets or shrinks it', () => {
  const viewport = { left: 10, top: 58, width: 320, height: 430 };
  const layout = tourLayout({ left: 24, top: 100, width: 288, height: 80 }, viewport, { width: 296, height: 240 }, 60);
  assert.equal(layout.card.left, 22);
  assert(layout.card.top >= viewport.top + 12);
  assert.equal(layout.card.top + 240, viewport.top + viewport.height - 60 - 12);
  assert(layout.spot.left >= viewport.left + 4);
});

test('tour controls stay in place when targets move between steps', () => {
  for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    const card = { width: Math.min(328, viewport.width - 24), height: 260 };
    const a = tourLayout({ left: 16, top: 20, width: 240, height: 44 }, viewport, card);
    const b = tourLayout({ left: 40, top: 300, width: 260, height: 300 }, viewport, card);
    assert.deepEqual(a.card, b.card);
    assert(a.card.left >= 12);
    assert(a.card.left + card.width <= viewport.width - 12);
    assert.equal(a.card.top + card.height, viewport.height - (viewport.width <= 760 ? 78 : 0) - 12);
  }
});

test('full card highlight includes padding and is independent of the hint position', () => {
  const viewport = { width: 390, height: 844 };
  const card = { width: 328, height: 260 };
  const target = { left: 16, top: 16, width: 358, height: 350 };
  const { spot } = tourLayout(target, viewport, card);
  assert.equal(spot.left, 6);
  assert.equal(spot.top, 4);
  assert.equal(spot.width, 378);
  assert.equal(spot.height, 374);
  const tall = tourLayout({ ...target, height: 900 }, viewport, card);
  assert.equal(tall.spot.top + tall.spot.height, viewport.height - 78 - 12);
});

test('offscreen targets never produce negative spotlight dimensions', () => {
  for (const target of [{ left: -100, top: -100, width: 150, height: 150 }, { left: 500, top: 1000, width: 150, height: 150 }]) {
    const { spot } = tourLayout(target, { width: 320, height: 740 }, { width: 296, height: 260 });
    assert(spot.width >= 0 && spot.height >= 0);
    assert(spot.left >= 4 && spot.left + spot.width <= 316);
  }
});

test('tour respects navigation safe area and fits a short mobile viewport', () => {
  const viewport = { width: 320, height: 450 };
  const card = { width: 296, height: 420 };
  const layout = tourLayout({ left: 16, top: 10, width: 288, height: 300 }, viewport, card, 102);
  assert.equal(layout.card.top, 12);
  assert(layout.spot.top + layout.spot.height <= viewport.height - 102 - 12);
});

import { nextTourIndex } from '../src/features/onboarding/tour-navigation.ts';

test('unavailable tour steps are skipped in both directions and at either end', () => {
  const steps = ['house', 'bill', 'meters', 'camera', 'finish'].map(target => ({ target }));
  assert.equal(nextTourIndex(steps, 0, 1, ['bill', 'meters', 'camera']), 4);
  assert.equal(nextTourIndex(steps, 4, -1, ['bill', 'meters', 'camera']), 0);
  assert.equal(nextTourIndex(steps, 0, -1, []), null);
  assert.equal(nextTourIndex(steps, 4, 1, []), null);
  assert.equal(nextTourIndex(steps, 0, 1, ['bill', 'meters', 'camera', 'finish']), null);
});

test('bottom action keeps its full highlight below an upper card and hanging mascot', () => {
  for (const viewport of [{ width: 440, height: 968 }, { width: 320, height: 600 }, { width: 1366, height: 900 }]) {
    const guideHeight = Math.max(72, Math.min(230, (viewport.height - 300) / 2));
    const target = { left: (viewport.width - 260) / 2, top: viewport.height - 160, width: 260, height: 50 };
    const card = { width: Math.min(440, viewport.width - 24), height: 220 };
    const result = tourLayout(target, viewport, card, 78, { placement: 'above', guideHeight });
    assert(result.card.top + card.height + guideHeight <= target.top - 16);
    assert(result.spot.top <= target.top);
    assert(result.spot.top + result.spot.height >= target.top + target.height);
    assert.equal(result.card.left, (viewport.width - card.width) / 2);
  }
});

test('location hint reserves space for the peeking mascot on a short screen', () => {
  const layout = tourLayout({ left: 16, top: 297, width: 288, height: 170 }, { width: 320, height: 600 }, { width: 296, height: 220 }, 60, { placement: 'above', guideHeight: 0, topInset: 60 });
  assert(layout.card.top >= 60);
  assert(layout.card.top + 220 < layout.spot.top);
});

test('a visible control does not cause an unnecessary page jump', () => {
  const range = { top: 16, bottom: 380 };
  assert.equal(tourScrollTop({ left: 16, top: 88, width: 360, height: 84 }, 0, range), 0);
  assert.equal(tourScrollTop({ left: 16, top: 100, width: 360, height: 200 }, 179, range), 179);
  assert.equal(tourScrollTop({ left: 16, top: 300, width: 360, height: 200 }, 179, range), 299);
});

test('highlight space reserves the whole mascot rather than covering the filters', () => {
  const viewport = { width: 393, height: 851 };
  const card = { width: 369, height: 280 };
  const layout = tourLayout({ left: 16, top: 195, width: 361, height: 435 }, viewport, card, 74);
  const range = tourFocusRange(viewport, { top: layout.card.top, height: card.height }, 126, 74, false);
  assert.equal(range.bottom + 126 + 16, layout.card.top);
  const fitted = { left: 16, top: 195, width: 361, height: range.bottom - range.top };
  const top = tourScrollTop(fitted, 0, range);
  assert.equal(fitted.top - top, range.top);
  assert.equal(fitted.top + fitted.height - top, range.bottom);
});

test('upper hints remain still as their target scrolls into view', () => {
  const viewport = { width: 393, height: 851 };
  const card = { width: 369, height: 220 };
  const options = { placement: 'above', guideHeight: 230 };
  const first = tourLayout({ left: 16, top: 650, width: 300, height: 50 }, viewport, card, 74, options);
  const next = tourLayout({ left: 16, top: 550, width: 300, height: 50 }, viewport, card, 74, options);
  assert.deepEqual(first.card, next.card);
});

test('a camera card is highlighted in full even when the guide overlaps it', () => {
  const target = { left: 16, top: 30, width: 358, height: 285 };
  const { spot } = tourLayout(target, { width: 390, height: 700 }, { width: 366, height: 290 }, 78);
  assert.equal(spot.top, target.top - 12);
  assert.equal(spot.height, target.height + 24);
  assert.equal(spot.width, target.width + 20);
});

test('a tall target is revealed through a separate scroll window without overlapping the hint', () => {
  const viewport = { width: 320, height: 568 };
  const target = { left: 16, top: 8, width: 288, height: 430 };
  const hint = { width: 296, height: 220 };
  const layout = tourLayout(target, viewport, hint, 72);
  const range = tourFocusRange(viewport, { ...layout.card, height: hint.height }, 0, 72, false, 10);
  const { spot } = tourLayout(target, viewport, hint, 72, undefined, range);
  assert(spot.height > 0);
  assert(spot.top >= range.top);
  assert(spot.top + spot.height <= range.bottom);
  assert(spot.top + spot.height < layout.card.top);
  assert.equal(target.height, 430);
});


test('one highlight spans separated controls and content without changing their layout', () => {
  assert.deepEqual(tourBounds([
    {left:16, top:90, width:358, height:50},
    {left:20, top:160, width:350, height:280},
  ]), {left:16, top:90, width:358, height:350});
});

test('attached hints stay close to their target and respect viewport edges', () => {
  const viewport = {width:390, height:844};
  const target = {left:16, top:80, width:358, height:280};
  const card = {width:366, height:240};
  const below = tourLayout(target, viewport, card, 74, {placement:'below', gap:20});
  assert.equal(below.card.top, 380);
  assert(below.card.top + card.height <= viewport.height - 74 - 12);
  const button = {...target, top:690, height:56};
  const above = tourLayout(button, viewport, card, 74, {placement:'above', guideHeight:160, attached:true});
  assert.equal(above.card.top + card.height + 160 + 12, button.top);
  const clipped = tourLayout({...target, top:700}, viewport, card, 74, {placement:'below', gap:20});
  assert.equal(clipped.card.top + card.height, viewport.height - 74 - 12);
});
