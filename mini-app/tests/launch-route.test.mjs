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

test('issue notifications open the exact issue and its UK chat', () => {
  assert.equal(launchRoute('start_param=issue_42'), '/issues/42/chat');
  assert.equal(launchRoute('', 'issue_2147483647'), '/issues/2147483647/chat');
  assert.equal(launchRoute('start_param=issue_7', 'issue_9'), '/issues/7/chat');
  for (const key of ['issue_0', 'issue_-1', 'issue_01', 'issue_1/chat', 'issue_1?x=y', 'issue_2147483648', 'issue_1.5', 'issue_']) {
    assert.equal(launchRoute('', key), undefined);
  }
  assert.equal(launchRoute('start_param=issue_1&start_param=issue_2'), undefined);
});
