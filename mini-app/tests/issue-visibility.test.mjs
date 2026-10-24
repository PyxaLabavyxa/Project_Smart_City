import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { visibleInSelectedHome } from '../src/entities/issue/model/issue-visibility.ts';
import { readPages } from '../src/shared/api/pagination.ts';

const house = {
  id: '1', residentApartment: 7, residentApartmentId: 10,
  entrances: 2, floors: 9, apartmentsPerFloor: 4,
  apartments: [{ id: 10, number: 7, entrance: 1, floor: 2 }, { id: 20, number: 37, entrance: 2, floor: 1 }],
};
const issue = (zone, entrance, mine = false) => ({ place: { houseId: '1', zone, entrance, floor: 1 }, mine });

test('switching between two owned apartments switches the entrance feed, including own common reports', () => {
  const first = issue('corridor', 1);
  const second = issue('elevator', 2);
  const ownSecond = issue('stairs', 2, true);
  assert(visibleInSelectedHome(first, house));
  assert(!visibleInSelectedHome(second, house));
  assert(!visibleInSelectedHome(ownSecond, house));
  const switched = { ...house, residentApartment: 37, residentApartmentId: 20 };
  assert(!visibleInSelectedHome(first, switched));
  assert(visibleInSelectedHome(second, switched));
  assert(visibleInSelectedHome(ownSecond, switched));
});

test('courtyard issues stay shared, private and legacy issues remain author-only', () => {
  for (const home of [house, { ...house, residentApartment: 37, residentApartmentId: 20 }]) {
    for (const zone of ['courtyard', 'house', 'parking']) assert(visibleInSelectedHome(issue(zone, 1), home));
    assert(visibleInSelectedHome(issue('apartment', 1, true), home));
    assert(!visibleInSelectedHome(issue('apartment', 1), home));
    assert(visibleInSelectedHome({ mine: true }, home));
    assert(!visibleInSelectedHome({ mine: false }, home));
  }
  assert(!visibleInSelectedHome({ ...issue('courtyard', 1), place: { ...issue('courtyard', 1).place, houseId: '2' } }, house));
});

test('pagination retains the selected apartment across every page', async () => {
  const paths = [];
  const rows = await readPages(async path => {
    paths.push(path);
    return paths.length === 1 ? { items: [1], next_cursor: 9 } : { items: [2], next_cursor: null };
  }, '/houses/1/issues?apartment_id=20', value => value);
  assert.deepEqual(rows, [1, 2]);
  assert.deepEqual(paths, ['/houses/1/issues?apartment_id=20&cursor=0&limit=100', '/houses/1/issues?apartment_id=20&cursor=9&limit=100']);
});

test('the issue gateway sends the selected apartment to the real pagination helper', async () => {
  const source = fs.readFileSync(new URL('../src/entities/issue/model/api-gateway.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('require', 'exports', compiled)(name => {
    if (name === '@/shared/api/client') return { endpoints: { issues: id => `/houses/${id}/issues` } };
    if (name === '@/shared/api/pagination') return { readPages };
    if (name === '@/shared/api/parse') return { record: value => value, array: (rows, parse) => rows.map(parse), number: Number };
    return {};
  }, exports);
  const paths = [];
  const api = async path => { paths.push(path); return { items: [], next_cursor: null }; };
  await exports.createIssueGateway(api, house).list();
  await exports.createIssueGateway(api, { ...house, residentApartmentId: 20, residentApartment: 37 }).list();
  assert.deepEqual(paths, ['/houses/1/issues?apartment_id=10&cursor=0&limit=100', '/houses/1/issues?apartment_id=20&cursor=0&limit=100']);
});
