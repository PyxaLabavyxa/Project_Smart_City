import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationHref, conversationApartment } from '../src/shared/api/conversation-route.ts';
import { deferLaunchOnboarding, launchTarget } from '../src/shared/api/launch-route.ts';
import { notificationHref } from '../src/features/notifications/notification-route.ts';
import { planReturn } from '../src/shared/api/plan-return.ts';

test('same neighbour number retains different own apartments across reload and plan return', () => {
  const first = conversationHref(8, 7);
  const other = conversationHref(8, 145);
  assert.notEqual(first, other);
  assert.equal(conversationApartment(other.split('?')[1]), 145);
  assert.equal(planReturn(other).href, other);
  for (const query of ['from=0', 'from=-1', 'from=abc', 'from=1&from=2', 'from=9007199254740992']) {
    assert(Number.isNaN(conversationApartment(query)));
  }
  assert.equal(conversationApartment(''), undefined);
});

test('QR home permits first onboarding; direct chat actions do not interrupt their task', () => {
  assert.equal(deferLaunchOnboarding(launchTarget('', 'home_house_1')), false);
  assert.equal(deferLaunchOnboarding(undefined), false);
  for (const section of ['report', 'issues', 'contacts']) {
    assert.equal(deferLaunchOnboarding(launchTarget('', `${section}_house_1`)), true);
  }
});

test('work notifications can open home while unsafe destinations remain rejected', () => {
  assert.equal(notificationHref('/'), '/');
  assert.equal(notificationHref('/issues/11'), '/issues/11');
  for (const href of ['//example.com', 'https://example.com', 'javascript:alert(1)', '/?next=https://example.com', '/unknown', null]) {
    assert.equal(notificationHref(href), null);
  }
});
