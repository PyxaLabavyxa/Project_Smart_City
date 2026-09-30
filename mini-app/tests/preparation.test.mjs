import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTour } from '../src/features/onboarding/prepare.ts';

async function prepareWithCameras(cameraCount, stopAt, updates = [], redirects = {}) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const controller = new AbortController();
  const visited = [];
  let pathname = '/';
  const main = { get dataset() { return { pagePath: pathname }; }, querySelector: () => null, querySelectorAll: () => [] };
  globalThis.document = {
    fonts: { status: 'loaded' },
    querySelector: selector => selector === '#main' ? main : null,
    querySelectorAll: () => pathname === '/cameras' ? Array.from({ length: cameraCount }, (_, index) => ({ pathname: `/cameras/${index + 1}` })) : [],
  };
  globalThis.window = { setInterval: callback => { queueMicrotask(callback); return 0; } };
  try {
    const camera = await prepareTour({
      prefetch() {},
      replace(href) {
        visited.push(href);
        pathname = (redirects[href] ?? href).split('?')[0];
        if (href === stopAt) controller.abort();
      },
    }, controller.signal, percent => updates.push(percent), '/utilities?invoice=latest');
    return { camera, visited, updates };
  } finally {
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  }
}

test('startup warms the camera page without discovering or visiting camera connections', async () => {
  for (const cameraCount of [0, 1, 4, 14]) {
    const { camera, visited, updates } = await prepareWithCameras(cameraCount);
    assert.equal(updates[0], 0);
    assert.equal(updates.at(-1), 100);
    assert(updates.slice(0, -1).every(value => value <= 90));
    assert(updates.every((value, index) => index === 0 || value >= updates[index - 1]));
    assert.equal(visited.at(-1), '/utilities?invoice=latest');
    assert.equal(visited.filter(path => /^\/cameras\/\d+$/.test(path)).length, 0);
    assert(visited.includes('/cameras'));
    assert.equal(camera, '/cameras');
  }
});

test('cancelling page preparation never reports successful completion', async () => {
  const updates = [];
  await assert.rejects(prepareWithCameras(4, '/cameras', updates), { name: 'AbortError' });
  assert(!updates.includes(100));
});

test('a cached health redirect with a trailing slash does not stop preparation at 63 percent', async () => {
  const { updates, visited } = await prepareWithCameras(4, undefined, [], { '/health': '/health/' });
  assert(updates.some(value => Math.round(value) === 63));
  assert.equal(updates.at(-1), 100);
  assert(visited.includes('/info'));
  assert(visited.includes('/more'));
});

test('preparation completes when the return page has a trailing slash and a query', async () => {
  const { updates, visited } = await prepareWithCameras(0, undefined, [], { '/utilities?invoice=latest': '/utilities/?invoice=latest' });
  assert.equal(visited.at(-1), '/utilities?invoice=latest');
  assert.equal(updates.at(-1), 100);
});
