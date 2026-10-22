import test from 'node:test';
import assert from 'node:assert/strict';
import { preloadImages } from '../src/shared/ui/image-preload.ts';

const originalImage = globalThis.Image;
const created = [];
class TestImage {
  constructor() { created.push(this); }
  decode() { return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); }
}
globalThis.Image = TestImage;
test.after(() => { globalThis.Image = originalImage; });

test('all unique guide images must finish decoding before preparation completes', async () => {
  const progress = [];
  const start = created.length;
  const preparation = preloadImages(['/open.webp', '/point.webp', '/open.webp'], new AbortController().signal, value => progress.push(value));
  assert.equal(created.length - start, 2);
  assert.deepEqual(progress, []);
  created[start].resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(progress, [50]);
  created[start + 1].resolve();
  await preparation;
  assert.equal(progress.at(-1), 100);
  const count = created.length;
  await preloadImages(['/open.webp', '/point.webp'], new AbortController().signal);
  assert.equal(created.length, count, 'replaying the tour reuses the same decoded resources');
});

test('cancelled preparation never reports completion', async () => {
  const controller = new AbortController(), progress = [];
  const preparation = preloadImages(['/rest.webp'], controller.signal, value => progress.push(value));
  controller.abort();
  await assert.rejects(preparation, { name: 'AbortError' });
  created.at(-1).resolve();
  assert(!progress.includes(100));
});

test('an image failure remains retryable and never finishes a partial preparation', async () => {
  let preparation = preloadImages(['/peek.webp'], new AbortController().signal);
  created.at(-1).reject(new Error('offline'));
  await assert.rejects(preparation, /offline/);
  const count = created.length;
  preparation = preloadImages(['/peek.webp'], new AbortController().signal);
  assert.equal(created.length, count + 1);
  created.at(-1).resolve();
  await preparation;
});
