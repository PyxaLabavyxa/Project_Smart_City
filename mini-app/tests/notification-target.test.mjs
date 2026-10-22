import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationApartment } from '../src/features/notifications/target.ts';

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
