import test from 'node:test';
import assert from 'node:assert/strict';
import { residentFloorLocation } from '../src/entities/house/model/house.ts';

const house = { id:'1', address:'Солнечная, 1', entrances:2, floors:9, apartmentsPerFloor:4, residentApartment:37 };
test('home starts at the entrance and floor of the selected apartment', () => {
  assert.deepEqual(residentFloorLocation(house), {houseId:'1', entrance:2, floor:1, zone:'corridor'});
  assert.deepEqual(residentFloorLocation({...house,residentApartment:72}), {houseId:'1', entrance:2, floor:9, zone:'corridor'});
  assert.deepEqual(residentFloorLocation({...house,residentApartment:1}), {houseId:'1', entrance:1, floor:1, zone:'corridor'});
});
test('actual apartment coordinates take precedence over calculated numbering, including partial profile data', () => {
  const apartment = { id:5, number:37, entrance:2, floor:6 };
  assert.deepEqual(residentFloorLocation({...house,apartments:[apartment]}), {houseId:'1', entrance:2, floor:6, zone:'corridor'});
  assert.deepEqual(residentFloorLocation({...house,apartments:[{id:1,number:1,entrance:1,floor:1},apartment]}), {houseId:'1', entrance:2, floor:6, zone:'corridor'});
});
test('missing apartment data has a safe fallback and resolves once the apartment list arrives', () => {
  assert.deepEqual(residentFloorLocation({...house,apartments:[]}), {houseId:'1', entrance:1, floor:1, zone:'corridor'});
  assert.deepEqual(residentFloorLocation({...house,apartments:[{id:5,number:37,entrance:2,floor:1}]}), {houseId:'1', entrance:2, floor:1, zone:'corridor'});
  assert.deepEqual(residentFloorLocation({...house,id:'2',residentApartment:4}), {houseId:'2', entrance:1, floor:1, zone:'corridor'});
});
