import test from 'node:test';
import assert from 'node:assert/strict';
import { launchRoute, launchTarget } from '../src/shared/api/launch-route.ts';

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

test('report opens issue creation and contacts remain available', () => {
  assert.equal(launchRoute('start_param=report'), '/issues/new');
  assert.equal(launchRoute('', 'contacts'), '/contacts');
});

test('chat menu carries a bounded house identity for every button', () => {
  for (const [section, href] of [['report', '/issues/new'], ['issues', '/issues'], ['contacts', '/contacts']]) {
    assert.deepEqual(launchTarget(`start_param=${section}_house_2`), { href, houseId: '2' });
    assert.deepEqual(launchTarget('', `${section}_house_2147483647`), { href, houseId: '2147483647' });
  }
  for (const key of ['report_house_0', 'report_house_01', 'report_house_-1', 'report_house_2147483648', 'report_house_2?x=y', 'report_house_2/3', 'cameras_house_2']) {
    assert.equal(launchTarget('', key), undefined);
  }
  assert.equal(launchTarget('start_param=report_house_2&start_param=report_house_3'), undefined);
  assert.deepEqual(launchTarget('start_param=report_house_2', 'report_house_3'), { href: '/issues/new', houseId: '2' });
});
