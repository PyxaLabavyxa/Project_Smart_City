import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationTarget } from '../src/features/registration/registration-target.ts';
import { launchTarget, browserLaunchTarget, launchNavigationHref } from '../src/shared/api/launch-route.ts';

const companies = [
  { id: 1, houses: [{ id: 2, address: 'Солнечная, 1' }] },
  { id: 3, houses: [{ id: 8, address: 'Солнечная, 3' }] },
];

test('invitation selects its company and exact house, not the first available company', () => {
  assert.deepEqual(registrationTarget(companies, '8'), { companyId: 3, houseId: 8, address: 'Солнечная, 3' });
  assert.equal(registrationTarget(companies, '9'), undefined);
  assert.equal(registrationTarget(companies, '08'), undefined);
  assert.equal(registrationTarget([], '8'), undefined);
  assert.deepEqual(registrationTarget(companies), { companyId: 1, houseId: 0, address: '' });
});

test('printed invitations open the house home while chat buttons retain their intended destination', () => {
  assert.deepEqual(launchTarget('', 'home_house_8'), { href: '/', houseId: '8' });
  assert.deepEqual(launchTarget('', 'report_house_8'), { href: '/issues/new', houseId: '8' });
  for (const value of ['home_house_0', 'home_house_08', 'home_house_-8', 'home_house_2147483648', 'home_house_8/contacts']) {
    assert.equal(launchTarget('', value), undefined);
  }
});

test('registration reload retains its exact house and destination without an open redirect', () => {
  for (const start of ['home_house_8', 'report_house_8', 'issues_house_8', 'contacts_house_8']) {
    const target = launchTarget('', start);
    const href = launchNavigationHref(target);
    assert.deepEqual(browserLaunchTarget(new URL(href, 'https://example.test').search), target);
  }
  assert.equal(browserLaunchTarget('?startapp=home_house_8&startapp=home_house_2'), undefined);
  assert.equal(browserLaunchTarget('?startapp=https://example.test'), undefined);
  assert.equal(launchNavigationHref(launchTarget('', 'issue_8')), '/issues/8/chat');
});
