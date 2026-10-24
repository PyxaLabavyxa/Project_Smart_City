import test from 'node:test';
import assert from 'node:assert/strict';
import { availableIssueCategories, availableIssueZones, changeIssueCategoryFilter, changeIssueLocationFilter, normalizeIssueFilters, filterIssues, initialIssueFilters, issueCategories, issueStatusLabels, issueFilterZones, issueFilterCategoryLabel } from '../src/entities/issue/model/issue-filters.ts';
import { categoriesForPlace } from '../src/entities/issue/model/report-categories.ts';

const house = { entrances: 2, floors: 9 };
const issue = (category, zone, status = 'new') => ({ category, status, title: category, description: '', location: zone, createdAt: '2026-10-24T00:00:00Z', place: { zone, entrance: 2, floor: 5 } });
const zones = issueFilterZones;

test('all supported categories remain available even with no matching issues', () => {
  assert.deepEqual(availableIssueCategories('corridor'), ['Электричество', 'Подъезд', 'Мусор', 'Водоснабжение', 'Отопление', 'Безопасность', 'Другое']);
  assert.deepEqual(availableIssueCategories(''), issueCategories);
  assert(!availableIssueCategories('elevator').includes('Двор'));
  assert(!availableIssueCategories('courtyard').includes('Лифт'));
  assert.equal(filterIssues([], { ...initialIssueFilters, zone: 'corridor', category: 'Отопление' }).length, 0);
});

test('every place uses the same category rules as issue creation', () => {
  for (const zone of zones) {
    const allowed = categoriesForPlace({ zone }).map(category => category.value);
    assert.deepEqual(availableIssueCategories(zone), allowed);
    for (const category of issueCategories) {
      const filters = normalizeIssueFilters({ ...initialIssueFilters, zone, category }, house);
      assert.equal(filters.category, allowed.includes(category) ? category : '', `${zone}: ${category}`);
    }
  }
});

test('changing place clears incompatible categories and keeps compatible selections and other filters', () => {
  const filters = { ...initialIssueFilters, category: 'Двор', zone: 'courtyard', status: 'accepted', onlyMine: true, query: 'лампа' };
  const elevator = changeIssueLocationFilter(filters, 'zone', 'elevator', house);
  assert.equal(elevator.category, '');
  assert.equal(elevator.status, 'accepted');
  assert.equal(elevator.onlyMine, true);
  assert.equal(elevator.query, 'лампа');
  for (const category of ['Водоснабжение', 'Отопление', 'Подъезд']) {
    const changed = changeIssueLocationFilter({ ...filters, zone: 'corridor', category }, 'zone', 'elevator', house);
    assert.equal(changed.category, '', category);
  }
  const compatible = changeIssueLocationFilter({ ...filters, category: 'Электричество' }, 'zone', 'elevator', house);
  assert.equal(compatible.category, 'Электричество');
  assert.equal(changeIssueLocationFilter(compatible, 'zone', 'parking', house).category, 'Электричество');
  assert.equal(filters.category, 'Двор');
});

test('outdoors clear floor and entrance; entrance locks floor 1; indoor controls allow valid house floors', () => {
  const filters = { ...initialIssueFilters, entrance: '2', floor: '5' };
  for (const zone of ['courtyard', 'parking']) {
    const next = changeIssueLocationFilter(filters, 'zone', zone, house);
    assert.equal(next.entrance, '');
    assert.equal(next.floor, '');
  }
  const entrance = changeIssueLocationFilter(filters, 'zone', 'entrance', house);
  assert.equal(entrance.floor, '1');
  assert.equal(entrance.entrance, '2');
  assert.equal(changeIssueLocationFilter(entrance, 'zone', 'elevator', house).floor, '');
  const elevator = changeIssueLocationFilter(filters, 'zone', 'elevator', house);
  assert.equal(elevator.floor, '5');
  assert.equal(elevator.entrance, '2');
});

test('invalid saved URL filters cannot leave invisible active constraints', () => {
  for (const value of ['-1', '0', '1.5', '01', '999', 'wrong']) {
    const next = normalizeIssueFilters({ ...initialIssueFilters, entrance: value, floor: value }, house);
    assert.equal(next.entrance, '');
    assert.equal(next.floor, '');
  }
  const next = normalizeIssueFilters({ ...initialIssueFilters, zone: 'unknown', category: 'unknown', status: 'unknown' }, house);
  assert.equal(next.zone, '');
  assert.equal(next.category, '');
  assert.equal(next.status, 'all');
  assert(!issueFilterZones.includes('house'));
  assert.equal(normalizeIssueFilters({ ...initialIssueFilters, zone: 'house' }, house).zone, '');
});

test('all five staff statuses filter independently and category choices do not depend on status', () => {
  assert.deepEqual(Object.values(issueStatusLabels), ['Новое', 'Принято', 'Поручено', 'В работе', 'Решено']);
  const issues = Object.keys(issueStatusLabels).map(status => issue('Лифт', 'elevator', status));
  for (const status of Object.keys(issueStatusLabels)) {
    const selected = filterIssues(issues, { ...initialIssueFilters, status, category: 'Лифт', zone: 'elevator', entrance: '2', floor: '5' });
    assert.equal(selected.length, 1);
    assert.equal(selected[0].status, status);
  }
  assert.deepEqual(availableIssueCategories('elevator'), ['Лифт', 'Электричество', 'Мусор', 'Безопасность', 'Другое']);
});

test('category selection narrows places without depending on existing issues', () => {
  const heating = changeIssueCategoryFilter(initialIssueFilters, 'Отопление', house);
  assert.deepEqual(availableIssueZones(heating), ['corridor', 'stairs', 'technical', 'entrance', 'apartment']);
  assert.deepEqual(availableIssueZones({ ...initialIssueFilters, category: 'Лифт' }), ['elevator', 'technical']);
  assert.deepEqual(availableIssueZones({ ...initialIssueFilters, category: 'Двор' }), ['courtyard', 'parking']);
  assert.equal(changeIssueCategoryFilter({ ...heating, zone: 'stairs' }, '', house).zone, 'stairs');
});

test('floor 5 and a selected entrance exclude outdoor places; floor 5 also excludes the entrance door', () => {
  const upstairs = changeIssueLocationFilter(initialIssueFilters, 'floor', '5', house);
  assert.deepEqual(availableIssueZones(upstairs), ['corridor', 'stairs', 'elevator', 'technical', 'apartment']);
  assert(!availableIssueCategories('', upstairs).includes('Двор'));
  const firstFloor = { ...upstairs, floor: '1' };
  assert(availableIssueZones(firstFloor).includes('entrance'));
  assert(!availableIssueZones(firstFloor).includes('courtyard'));
  const entrance = { ...initialIssueFilters, entrance: '2' };
  assert(!availableIssueZones(entrance).includes('parking'));
  assert(!availableIssueCategories('', entrance).includes('Двор'));
  assert.deepEqual(availableIssueZones(changeIssueLocationFilter(upstairs, 'floor', '', house)), issueFilterZones);
});

test('the latest category or location choice clears older conflicting values', () => {
  const yard = { ...initialIssueFilters, zone: 'courtyard', category: 'Двор' };
  const upstairs = changeIssueLocationFilter(yard, 'floor', '5', house);
  assert.equal(upstairs.floor, '5');
  assert.equal(upstairs.zone, '');
  assert.equal(upstairs.category, '');
  const moved = changeIssueLocationFilter({ ...initialIssueFilters, zone: 'entrance', floor: '1' }, 'floor', '5', house);
  assert.equal(moved.zone, '');
  assert.equal(moved.floor, '5');
  const heating = changeIssueCategoryFilter({ ...initialIssueFilters, zone: 'elevator', floor: '5' }, 'Отопление', house);
  assert.equal(heating.zone, '');
  assert.equal(heating.category, 'Отопление');
  assert.equal(heating.floor, '5');
  const yardCategory = changeIssueCategoryFilter({ ...initialIssueFilters, entrance: '2', floor: '5' }, 'Двор', house);
  assert.equal(yardCategory.category, 'Двор');
  assert.equal(yardCategory.entrance, '');
  assert.equal(yardCategory.floor, '');
});

test('the automatic entrance floor does not lock the place selector to indoor locations', () => {
  const entrance = { ...initialIssueFilters, zone: 'entrance', floor: '1' };
  assert(availableIssueZones(entrance).includes('courtyard'));
  assert.equal(changeIssueLocationFilter(entrance, 'zone', 'courtyard', house).floor, '');
});

test('category labels describe the problem instead of repeating a place name', () => {
  assert.equal(issueFilterCategoryLabel('Подъезд', 'stairs'), 'Двери и общие зоны');
  assert.equal(issueFilterCategoryLabel('Подъезд', ''), 'Двери и общие зоны');
  assert.equal(issueFilterCategoryLabel('Электричество', 'courtyard'), 'Уличное освещение');
  assert.equal(issueFilterCategoryLabel('Электричество', 'elevator'), 'Освещение и электрика');
});
