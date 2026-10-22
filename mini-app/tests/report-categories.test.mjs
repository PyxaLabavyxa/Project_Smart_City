import test from 'node:test';
import assert from 'node:assert/strict';
import { categoriesForPlace, reportScope, reportCategoryLabel, reportVisibilityLabel } from '../src/entities/issue/model/report-categories.ts';
import { emptyDraft, initialReportStep, updateIssueDraft } from '../src/entities/issue/model/issue-draft.ts';
import { sameLocation, formatLocation, locationQuery, parseLocation } from '../src/entities/house/model/house.ts';
import { similarIssues } from '../src/entities/issue/model/similar-issues.ts';
import { filterIssues, initialIssueFilters } from '../src/entities/issue/model/issue-filters.ts';

const place = zone => ({ houseId: '1', entrance: 1, floor: 1, zone });
const values = zone => categoriesForPlace(place(zone)).map(item => item.value);

test('visibility hints follow the selected place and entrance', () => {
  assert.match(reportVisibilityLabel(place('apartment')), /только вы и сотрудники/);
  for (const zone of ['courtyard', 'parking', 'house']) {
    assert.match(reportVisibilityLabel(place(zone)), /все жители дома/);
  }
  for (const zone of ['corridor', 'stairs', 'elevator', 'technical', 'entrance']) {
    assert.match(reportVisibilityLabel({ ...place(zone), entrance: 3 }), /подъезда №3/);
  }
});

test('courtyard has outdoor subcategories without lift, entrance or heating', () => {
  for (const zone of ['courtyard', 'parking', 'house']) {
    assert.equal(reportScope(place(zone)), 'courtyard');
    assert.deepEqual(values(zone), ['Двор', 'Мусор', 'Электричество', 'Водоснабжение', 'Безопасность', 'Другое']);
  }
  assert.equal(reportCategoryLabel(place('courtyard'), 'Электричество'), 'Уличное освещение');
});

test('entrance categories work upstairs; private apartments exclude common property', () => {
  const upstairs = { ...place('corridor'), floor: 12 };
  assert(categoriesForPlace(upstairs).some(item => item.value === 'Подъезд'));
  assert(values('stairs').includes('Лифт'));
  assert(!values('corridor').includes('Двор'));
  assert.deepEqual(values('apartment'), ['Водоснабжение', 'Отопление', 'Электричество', 'Безопасность', 'Другое']);
});

test('new drafts start with scope selection; explicit places keep their next step', () => {
  for (const zone of ['courtyard', 'parking', 'house', 'apartment']) {
    assert.equal(emptyDraft(place(zone)).step, -1);
    assert.equal(initialReportStep(place(zone)), 1);
  }
  for (const zone of ['corridor', 'stairs', 'elevator', 'technical', 'entrance']) {
    assert.equal(emptyDraft(place(zone)).step, -1);
    assert.equal(initialReportStep(place(zone)), 0);
  }
});

test('changing scope clears incompatible subcategories and keeps text and attachments', () => {
  const draft = { ...emptyDraft(place('corridor')), category: 'Лифт', title: 'Заголовок', description: 'Описание', photos: [{ id: 'photo' }], step: 2 };
  const moved = updateIssueDraft(draft, { place: place('courtyard'), step: 1 });
  assert.equal(moved.category, '');
  assert.equal(moved.title, draft.title);
  assert.equal(moved.description, draft.description);
  assert.equal(moved.photos, draft.photos);
  assert.equal(updateIssueDraft(moved, { place: place('corridor') }).category, '');
  assert.equal(updateIssueDraft({ ...draft, category: 'Электричество' }, { place: place('courtyard') }).category, 'Электричество');
});

test('outdoor identity, duplicate detection and links ignore legacy floor sentinels', () => {
  const courtyard = place('courtyard');
  const legacy = { ...courtyard, entrance: 2, floor: 3 };
  assert(sameLocation(courtyard, legacy));
  assert.equal(formatLocation(legacy), 'Двор');
  assert.equal(locationQuery(courtyard), 'house=1&zone=courtyard');
  const house = { id: '1', entrances: 2, floors: 9, apartmentsPerFloor: 4 };
  assert.deepEqual(parseLocation(house, { house: '1', zone: 'courtyard' }), courtyard);
  const issue = { id: '1', category: 'Двор', status: 'new', place: legacy };
  assert.equal(similarIssues([issue], courtyard, 'Двор').length, 1);
  assert.equal(filterIssues([issue], { ...initialIssueFilters, floor: '3' }).length, 0);
  assert.equal(filterIssues([issue], { ...initialIssueFilters, entrance: '2' }).length, 0);
});
