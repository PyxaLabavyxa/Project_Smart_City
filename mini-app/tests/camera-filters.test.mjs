import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCameras } from '../src/_pages/cameras/model/camera.ts';
import { changeLocationFilter } from '../src/entities/house/model/house.ts';

const cameras = [
  { id: 'legacy', mine: false, visibility: 'public', moderationStatus: 'approved' },
  { id: 'own-yard', mine: true, visibility: 'private', moderationStatus: 'approved', place: { entrance: 1, floor: 1, zone: 'courtyard' } },
  { id: 'own-floor', mine: true, visibility: 'public', moderationStatus: 'pending', place: { entrance: 2, floor: 3, zone: 'corridor' } },
  { id: 'shared', mine: false, visibility: 'public', moderationStatus: 'approved', place: { entrance: 2, floor: 3, zone: 'corridor' } },
];
const defaults = { type: 'all', entrance: '', floor: '', zone: '' };

test('my cameras and location filters combine without hiding legacy cameras by default', () => {
  const ids = changes => filterCameras(cameras, { ...defaults, ...changes }).map(c => c.id);
  assert.deepEqual(ids({}), ['legacy', 'own-yard', 'own-floor', 'shared']);
  assert.deepEqual(ids({ type: 'mine' }), ['own-yard', 'own-floor']);
  assert.deepEqual(ids({ type: 'public' }), ['legacy', 'shared']);
  assert.deepEqual(ids({ type: 'public', floor: '3' }), ['shared']);
  assert.deepEqual(ids({ type: 'mine', entrance: '2', floor: '3', zone: 'corridor' }), ['own-floor']);
  assert.deepEqual(ids({ zone: 'courtyard' }), ['own-yard']);
  assert.deepEqual(ids({ type: 'mine', entrance: '1', floor: '3' }), []);
});

test('outdoor locations clear incompatible filters and stay outside floor searches', () => {
  for (const zone of ['courtyard', 'parking', 'house']) {
    assert.deepEqual(changeLocationFilter({ ...defaults, entrance: '2', floor: '5' }, 'zone', zone), { ...defaults, zone });
  }
  assert.equal(changeLocationFilter({ ...defaults, floor: '5' }, 'zone', 'entrance').floor, '1');
  assert.deepEqual(filterCameras(cameras, { ...defaults, floor: '1' }), []);
  assert.deepEqual(filterCameras(cameras, { ...defaults, entrance: '1' }), []);
});
