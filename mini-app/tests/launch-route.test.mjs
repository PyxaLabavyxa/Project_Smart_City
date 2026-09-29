import test from 'node:test';
import assert from 'node:assert/strict';
import { launchRoute } from '../src/shared/api/launch-route.ts';

test('MAX menu launch parameters open the requested section', () => {
  for (const section of ['issues', 'utilities', 'cameras', 'messages']) {
    assert.equal(launchRoute(`user=%7B%7D&start_param=${section}`), `/${section}`);
    assert.equal(launchRoute('', section), `/${section}`);
  }
});

test('missing, conflicting and untrusted launch routes are ignored', () => {
  for (const value of [undefined, {}, '__proto__', 'https://example.com', 'javascript:alert(1)']) {
    assert.equal(launchRoute('', value), undefined);
  }
  assert.equal(launchRoute('start_param=issues&start_param=cameras'), undefined);
  assert.equal(launchRoute('start_param=issues', 'cameras'), '/issues');
});
