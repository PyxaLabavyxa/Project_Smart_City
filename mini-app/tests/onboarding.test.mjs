import test from 'node:test';
import assert from 'node:assert/strict';
import { tourLayout } from '../src/features/onboarding/tour-layout.ts';

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

test('full card highlight includes padding and stays clear of the tour controls', () => {
  const viewport = { width: 390, height: 844 };
  const card = { width: 328, height: 260 };
  const target = { left: 16, top: 16, width: 358, height: 350 };
  const { spot } = tourLayout(target, viewport, card);
  assert.equal(spot.left, 8);
  assert.equal(spot.top, 8);
  assert.equal(spot.width, 374);
  assert.equal(spot.height, 366);
  const tall = tourLayout({ ...target, height: 900 }, viewport, card);
  assert(tall.spot.top + tall.spot.height <= tall.card.top - 12);
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
  assert(layout.spot.top + layout.spot.height <= layout.card.top);
});
