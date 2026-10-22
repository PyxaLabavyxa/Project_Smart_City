import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createApiClient, endpoints, maxLaunchData } from '../src/shared/api/client.ts';

const signedLaunch = 'auth_date=123&user=%7B%22id%22%3A101%7D&hash=signed-by-max';
const unauthorized = () => Response.json({ detail: 'Откройте приложение из MAX' }, { status: 401 });

function browserWindow(t, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window; });
}

function requests(t, responses) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, ...options, headers: new Headers(options.headers) });
    const response = responses.shift();
    assert(response, 'unexpected extra request');
    return typeof response === 'function' ? response(options) : response;
  });
  return calls;
}

test('normal MAX keeps cookie authentication without adding launch data to requests', async t => {
  const calls = requests(t, [new Response(null, { status: 204 }), Response.json({ id: 1 })]);
  const api = createApiClient({ maxInitData: signedLaunch });
  await api(endpoints.login, { body: { init_data: signedLaunch } });
  assert.deepEqual(await api(endpoints.me), { id: 1 });
  assert.equal(calls.length, 2);
  assert(calls.every(call => call.credentials === 'include' && !call.headers.has('Authorization')));
});

test('blocked third-party cookies fall back once to signed data and reuse that transport', async t => {
  const calls = requests(t, [unauthorized(), Response.json({ id: 1 }), Response.json({ items: [] }), new Response(null, { status: 204 })]);
  const api = createApiClient({ maxInitData: signedLaunch });
  assert.deepEqual(await api(endpoints.me), { id: 1 });
  await api(endpoints.issues('1'));
  await api(endpoints.presence, { body: { active: true } });
  assert.equal(calls.length, 4);
  assert.equal(calls[0].headers.get('Authorization'), null);
  assert.equal(calls[1].headers.get('Authorization'), `Bearer ${signedLaunch}`);
  assert.equal(calls[2].headers.get('Authorization'), `Bearer ${signedLaunch}`);
  assert.equal(calls[3].headers.get('Authorization'), `Bearer ${signedLaunch}`, 'presence also needs signed authentication');
  assert(calls.every(call => call.credentials === 'include' && !call.url.includes(signedLaunch)));
});

test('local/browser clients never copy MAX credentials implicitly', async t => {
  browserWindow(t, { WebApp: { initData: signedLaunch } });
  const calls = requests(t, [unauthorized()]);
  await assert.rejects(createApiClient()(endpoints.me), error => error instanceof ApiError && error.status === 401);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.get('Authorization'), null);
});

test('expired or rejected launch data stops after one retry', async t => {
  const calls = requests(t, [unauthorized(), unauthorized()]);
  await assert.rejects(createApiClient({ maxInitData: signedLaunch })(endpoints.me), error => error.status === 401);
  assert.equal(calls.length, 2);
});

test('permissions, validation and server errors do not retry a mutation', async t => {
  const calls = requests(t, [403, 422, 500].map(status => Response.json({ detail: 'Отклонено' }, { status })));
  const api = createApiClient({ maxInitData: signedLaunch });
  for (const status of [403, 422, 500]) {
    await assert.rejects(api('/issues/1/messages', { body: { text: 'Черновик', request_id: 'same' } }), error => error.status === status);
  }
  assert.equal(calls.length, 3);
});

test('JSON, multipart and DELETE keep their payload, abort signal and keepalive on fallback', async t => {
  const calls = requests(t, [unauthorized(), Response.json({ ok: true }), unauthorized(), Response.json({ ok: true }), unauthorized(), new Response(null, { status: 204 })]);
  const controller = new AbortController();
  const body = new FormData();
  body.append('data', JSON.stringify({ request_id: 'same-request' }));
  body.append('photos', new Blob(['image'], { type: 'image/png' }), 'photo.png');
  for (const options of [
    { body: { text: 'Сообщение', request_id: 'same-request' }, keepalive: true },
    { body },
    { method: 'DELETE' },
  ]) {
    await createApiClient({ maxInitData: signedLaunch })('/issues/1', { ...options, signal: controller.signal });
  }
  for (const index of [0, 2, 4]) {
    assert.equal(calls[index].body, calls[index + 1].body);
    assert.equal(calls[index].signal, calls[index + 1].signal);
    assert.equal(calls[index].method, calls[index + 1].method);
    assert.equal(calls[index].keepalive, calls[index + 1].keepalive);
  }
  assert.equal(calls[1].headers.get('Content-Type'), 'application/json');
  assert.equal(calls[3].body, body);
  assert.equal(calls[3].headers.get('Content-Type'), null, 'browser must create multipart boundary');
  assert.equal(calls[5].method, 'DELETE');
});

test('aborted initial request cannot start a signed retry', async t => {
  const controller = new AbortController();
  const calls = requests(t, [() => { controller.abort(); return unauthorized(); }]);
  await assert.rejects(createApiClient({ maxInitData: signedLaunch })(endpoints.me, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls.length, 1);
});

test('network errors are not replayed', async t => {
  const calls = requests(t, [() => { throw new TypeError('offline'); }]);
  await assert.rejects(createApiClient({ maxInitData: signedLaunch })(endpoints.me), error => error.status === 0);
  assert.equal(calls.length, 1);
});

test('logout never sends bearer credentials and clears the in-memory fallback', async t => {
  const calls = requests(t, [unauthorized(), Response.json({ id: 1 }), new Response(null, { status: 204 }), unauthorized()]);
  const api = createApiClient({ maxInitData: signedLaunch });
  await api(endpoints.me);
  await api(endpoints.logout, { body: {} });
  await assert.rejects(api(endpoints.me), error => error.status === 401);
  assert.equal(calls.length, 4);
  assert.equal(calls[2].headers.get('Authorization'), null);
  assert.equal(calls[3].headers.get('Authorization'), null);
});

test('a failed MAX login does not retry with Authorization', async t => {
  const calls = requests(t, [unauthorized()]);
  await assert.rejects(createApiClient({ maxInitData: signedLaunch })(endpoints.login, { body: { init_data: signedLaunch } }), error => error.status === 401);
  assert.equal(calls.length, 1);
});

test('protected image responses can use the same authentication without putting tokens in URLs', async t => {
  const bytes = new Uint8Array([137, 80, 78, 71]);
  const calls = requests(t, [unauthorized(), new Response(bytes, { headers: { 'Content-Type': 'image/png' } })]);
  const blob = await createApiClient({ maxInitData: signedLaunch })('/chat-photos/1', { responseType: 'blob' });
  assert(blob instanceof Blob);
  assert.equal(blob.type, 'image/png');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
  assert.equal(calls[1].headers.get('Authorization'), `Bearer ${signedLaunch}`);
});

test('MAX launch data survives an unavailable bridge and a router-cleared hash without storage', t => {
  const hash = `#WebAppData=${encodeURIComponent(signedLaunch)}&WebAppPlatform=web`;
  const browser = { location: { hash }, performance: { getEntriesByType: () => [] } };
  browserWindow(t, browser);
  assert.equal(maxLaunchData(), signedLaunch);
  browser.location.hash = '';
  browser.performance.getEntriesByType = () => [{ name: `https://domoved.example/${hash}` }];
  assert.equal(maxLaunchData(), signedLaunch);
  browser.location.hash = '#WebAppData=a&WebAppData=b';
  assert.equal(maxLaunchData(), '', 'duplicate current parameters must not restore an older launch');
  browser.location.hash = '';
  browser.performance.getEntriesByType = () => [{ name: 'invalid-url' }];
  assert.equal(maxLaunchData(), '');
});
