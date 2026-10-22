import test from 'node:test';
import assert from 'node:assert/strict';
import { activeHouseWorks, houseWorkStatus, parseHouseWork, workPeriod } from '../src/_pages/home/model/house-work.ts';

const item = (id, start, end) => parseHouseWork({ id, title: 'Замена труб', starts_at: start, ends_at: end, location: 'Подъезд 2', description: 'Наберите воду' });
test('house works retain ongoing jobs, sort upcoming jobs and hide completed ones', () => {
  const now = Date.parse('2030-03-01T10:00:00Z');
  const ended = item(1, '2030-03-01T08:00:00Z', '2030-03-01T10:00:00Z');
  const ongoing = item(2, '2030-03-01T09:00:00Z', '2030-03-01T11:00:00Z');
  const later = item(3, '2030-03-02T09:00:00Z', '2030-03-02T11:00:00Z');
  const input = [later, ended, ongoing];
  assert.deepEqual(activeHouseWorks(input, now).map(w => w.id), [2,3]);
  assert.deepEqual(input.map(w => w.id), [3,1,2]);
  assert.equal(houseWorkStatus(ended, now), 'Завершены');
  assert.equal(houseWorkStatus(ongoing, now), 'Идут работы');
  assert.equal(houseWorkStatus(later, now), 'Запланированы');
  assert.match(workPeriod(ongoing), /12:00.*14:00.*МСК/);
});
test('house works accept old cards and preserve descriptions without markup interpretation', () => {
  const old = parseHouseWork({ id:1, title:'Работа', starts_at:'2030-03-01T09:00:00Z', ends_at:'2030-03-01T11:00:00Z', location:'Двор' });
  assert.equal(old.description, '');
  assert.throws(() => item(1,'bad-date','bad-date'));
  assert.throws(() => item(1,'2030-03-01T10:00:00Z','2030-03-01T09:00:00Z'));
});
test('unknown deadlines stay active until manually completed and use explicit wording', () => {
  const work = item(4,'2030-03-01T09:00:00Z',null);
  assert.equal(work.endsAt,null);
  assert.deepEqual(activeHouseWorks([work],Date.parse('2031-01-01T00:00:00Z')),[work]);
  assert.equal(houseWorkStatus(work,Date.parse('2030-03-01T10:00:00Z')),'Идут работы');
  assert.equal(houseWorkStatus(work,Date.parse('2030-03-01T08:00:00Z')),'Запланированы');
  assert.match(workPeriod(work),/^С .*12:00.*МСК$/);
  assert.doesNotMatch(workPeriod(work),/Invalid|null|1970/);
});
test('same-day work dates are not repeated and overnight periods retain both dates', () => {
  const sameDay=workPeriod(item(1,'2030-03-01T09:00:00Z','2030-03-01T11:00:00Z'));
  assert.equal(sameDay.match(/мар/g).length,1);
  const midnight=workPeriod(item(1,'2030-03-01T20:00:00Z','2030-03-01T22:00:00Z'));
  assert.equal(midnight.match(/мар/g).length,2);
});
