import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationApartment } from '../src/features/notifications/target.ts';
import { notificationInboxHref, notificationReturn } from '../src/features/notifications/notification-route.ts';

const choices = [{id:1,houseId:'1'},{id:2,houseId:'1'},{id:3,houseId:'2'}];
test('personal notification selects the recipient apartment, including two in one house', () => {
  assert.equal(notificationApartment(choices,'1',2,1)?.id,2);
  assert.equal(notificationApartment(choices,'2',3,1)?.id,3);
});
test('house events preserve current apartment when possible and switch to another authorized house', () => {
  assert.equal(notificationApartment(choices,'1',null,2)?.id,2);
  assert.equal(notificationApartment(choices,'2',null,2)?.id,3);
});
test('removed or inconsistent apartment access never falls back to another recipient', () => {
  assert.equal(notificationApartment(choices,'1',99,1),undefined);
  assert.equal(notificationApartment(choices,'1',3,1),undefined);
  assert.equal(notificationApartment(choices,'99',null,1),undefined);
  assert.equal(notificationApartment(choices,null,null,1),undefined);
});

test('notification back link returns to the screen that opened the inbox', () => {
  for (const origin of ['/', '/utilities', '/issues', '/cameras', '/more', '/house', '/health', '/contacts', '/settings/notifications', '/issues/75', '/cameras/8/settings', '/issues/new', '/cameras/new']) {
    const inbox = new URL(notificationInboxHref(origin, ''), 'https://app.test');
    const savedOrigin = inbox.searchParams.get('returnTo');
    assert.equal(notificationReturn(savedOrigin).href, origin);
    // Opening the bell again must keep the original screen, not nest inbox URLs.
    assert.equal(notificationInboxHref('/notifications', inbox.search.slice(1)), inbox.pathname + inbox.search);
  }
});

test('notification origin survives reload with the exact apartment and plan query', () => {
  for (const origin of ['/messages/8?from=145', '/plan?entrance=2&floor=4&returnTo=%2Fmessages%2F8%3Ffrom%3D145']) {
    const [path, search] = origin.split('?');
    const inbox = new URL(notificationInboxHref(path, search), 'https://app.test');
    assert.equal(notificationReturn(inbox.searchParams.get('returnTo')).href, origin);
  }
});

test('direct inbox entry returns home and invalid return links cannot leave the app or loop', () => {
  for (const origin of [null, '/notifications', '/notifications?returnTo=%2Fissues', '//example.com', 'https://example.com', 'javascript:alert(1)', '/\\example.com', '/unknown', '/issues/1#bad', '/issues/1\n']) {
    assert.deepEqual(notificationReturn(origin), {href:'/',label:'На главную'});
  }
  assert.equal(notificationInboxHref('/notifications', ''), '/notifications?returnTo=%2F');
});
