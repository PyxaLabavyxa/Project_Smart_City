import test from 'node:test';
import assert from 'node:assert/strict';
import { floorApartments, totalApartments, findApartment, validStructure, resolveLocation, fallbackLocation, locationQuery, parseLocation } from '../src/entities/house/model/house.ts';

const house = { id: 'central-18', address: 'Центральная, 18', entrances: 2, floors: 9, apartmentsPerFloor: 4, residentApartment: 71 };

test('numbering stays continuous across entrances, odd floors and overrides', () => {
  for (const apartmentsPerFloor of [1, 4, 7, 12, 30, 60]) {
    const configured = { ...house, apartmentsPerFloor, overrides: { '1:1': 7, '2:8': 1 } };
    const numbers = [];
    for (let entrance = 1; entrance <= configured.entrances; entrance++) {
      for (let floor = 1; floor <= configured.floors; floor++) {
        for (const apartment of floorApartments(configured, entrance, floor)) {
          numbers.push(apartment);
          assert.deepEqual(findApartment(configured, apartment), { houseId: house.id, entrance, floor, zone: 'apartment', apartment });
        }
      }
    }
    assert.deepEqual(numbers, Array.from({ length: totalApartments(configured) }, (_, i) => i + 1));
  }
});

test('structure limits and invalid exceptions are rejected', () => {
  const maximum = { ...house, entrances: 8, floors: 40, apartmentsPerFloor: 60 };
  assert.equal(validStructure(maximum), true);
  assert.equal(totalApartments(maximum), 19200);
  assert.deepEqual(findApartment(maximum, 19200), { houseId: house.id, entrance: 8, floor: 40, zone: 'apartment', apartment: 19200 });
  for (const patch of [{ entrances: 0 }, { entrances: 9 }, { floors: 41 }, { floors: 1.5 }, { apartmentsPerFloor: NaN }, { overrides: { '1:10': 4 } }, { overrides: { '01:1': 4 } }, { overrides: { '1:1': 61 } }]) {
    assert.equal(validStructure({ ...house, ...patch }), false, JSON.stringify(patch));
  }
  for (const number of [0, -1, 19201, 3.5, NaN]) assert.equal(findApartment(maximum, number), null);
});

test('resizing relocates apartments, preserves outdoor zones and unbinds removed rooms', () => {
  const apartment = findApartment(house, 36);
  const smaller = { ...house, entrances: 1, floors: 9 };
  assert.equal(resolveLocation(smaller, apartment).entrance, 1);
  const removed = { houseId: house.id, entrance: 2, floor: 9, zone: 'stairs' };
  assert.equal(resolveLocation(smaller, removed), undefined);
  assert.deepEqual(fallbackLocation(smaller, removed), { houseId: house.id, entrance: 1, floor: 9, zone: 'corridor' });
  for (const zone of ['house', 'courtyard', 'parking']) {
    const outdoor = { houseId: house.id, entrance: 1, floor: 1, zone };
    assert.deepEqual(resolveLocation(smaller, outdoor), outdoor);
  }
});

test('plan deep links round-trip and reject malformed or obsolete locations', () => {
  const place = findApartment(house, 71);
  const params = Object.fromEntries(new URLSearchParams(locationQuery(place)));
  assert.deepEqual(parseLocation(house, params), place);
  for (const patch of [{ house: 'other-house' }, { floor: '8' }, { zone: 'unknown' }, { apartment: ['71', '72'] }, { entrance: 'NaN' }]) {
    assert.equal(parseLocation(house, { ...params, ...patch }), undefined);
  }
});
