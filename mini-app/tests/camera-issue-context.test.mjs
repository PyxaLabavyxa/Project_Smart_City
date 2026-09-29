import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraIssueContext } from '../src/_pages/cameras/model/camera-issue-context.ts';

const house = { id: '42', entrances: 3 };
const camera = { id: '17', name: 'Двор', note: 'Двор и детская площадка', status: 'online' };

test('numeric camera IDs preserve courtyard and entrance context', () => {
  assert.deepEqual(cameraIssueContext(camera, house), {
    place: { houseId: '42', entrance: 1, floor: 1, zone: 'courtyard' }, category: 'Двор',
  });
  assert.deepEqual(cameraIssueContext({ ...camera, name: 'Подъезд 3' }, house), {
    place: { houseId: '42', entrance: 3, floor: 1, zone: 'entrance' }, category: 'Подъезд',
  });
});

test('unknown cameras and missing entrances do not guess a category or place', () => {
  assert.equal(cameraIssueContext({ ...camera, name: 'Подъезд 4' }, house), undefined);
  assert.equal(cameraIssueContext({ ...camera, name: 'Камера 17' }, house), undefined);
});
