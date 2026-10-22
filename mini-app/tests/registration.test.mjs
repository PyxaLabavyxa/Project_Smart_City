import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRegistration } from '../src/features/registration/model.ts';

test('registration preserves actual entrance ranges, including nonstandard numbering', () => {
  const state = parseRegistration({
    complete: false, test_mode: true, name: 'Иван Петров', status: null,
    companies: [{ id: 1, name: 'УК', houses: [{
      id: 1, address: 'Дом 1', floors: 9, apartments_count: 72,
      entrances: [
        { number: 1, first_apartment: 101, last_apartment: 135, apartments_count: 20 },
        { number: 2, first_apartment: 201, last_apartment: 235, apartments_count: 18 },
      ],
    }] }],
  });
  assert.deepEqual(state.companies[0].houses[0].entrances, [
    { number: 1, firstApartment: 101, lastApartment: 135, apartmentsCount: 20 },
    { number: 2, firstApartment: 201, lastApartment: 235, apartmentsCount: 18 },
  ]);
});
