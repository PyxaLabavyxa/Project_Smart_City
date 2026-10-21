import test from 'node:test';
import assert from 'node:assert/strict';
import { launchApartmentId } from '../src/entities/house/model/launch-selection.ts';

test('chat entry selects its authorized house rather than the first apartment', () => {
  const apartments = [{ id: 10, houseId: '3' }, { id: 20, houseId: '2' }, { id: 21, houseId: '2' }];
  assert.equal(launchApartmentId(apartments), 10);
  assert.equal(launchApartmentId(apartments, '2'), 20);
  assert.equal(launchApartmentId(apartments, '99'), undefined);
  assert.equal(launchApartmentId([], '2'), undefined);
  assert.equal(launchApartmentId([...apartments, { id: 30, houseId: '99' }], '99'), 30);
});
