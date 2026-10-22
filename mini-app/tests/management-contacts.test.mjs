import test from 'node:test';
import assert from 'node:assert/strict';
import { contactHref, contactInformation } from '../src/entities/management-company/model/contacts.ts';

test('contacts open telephone, email and website actions without treating an address as a link', () => {
  assert.equal(contactHref({ kind: 'phone', value: '+7 (495) 123-45-67' }), 'tel:+74951234567');
  assert.equal(contactHref({ kind: 'phone', value: '112' }), 'tel:112');
  assert.equal(contactHref({ kind: 'email', value: 'office@example.ru' }), 'mailto:office%40example.ru');
  assert.equal(contactHref({ kind: 'website', value: 'https://example.ru/contacts' }), 'https://example.ru/contacts');
  assert.equal(contactHref({ kind: 'address', value: 'Домовая, 1' }), undefined);
});

test('unsafe website protocols and embedded credentials never produce clickable links', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'ftp://example.ru', 'https://user:pass@example.ru', 'invalid']) {
    assert.equal(contactHref({ kind: 'website', value }), undefined);
  }
});

test('the company website shown in information is a safe saved contact', () => {
  const unsafe = { kind: 'website', label: 'Сайт', value: 'javascript:alert(1)', note: '' };
  const website = { ...unsafe, value: 'https://example.ru/contacts' };
  assert.equal(contactInformation([unsafe, website]).website, website);
  assert.equal(contactInformation([unsafe]).website, undefined);
});

test('saved office and reception schedules are separate, non-clickable information', () => {
  const hours = { kind: 'schedule', label: 'График работы', value: 'Пн–пт, 9:00–18:00', note: '' };
  const reception = { ...hours, label: 'Приём жителей', value: 'Вт, 15:00–18:00' };
  const info = contactInformation([reception, hours]);
  assert.equal(info.hours, hours);
  assert.equal(info.reception, reception);
  assert.equal(contactHref(hours), undefined);
});

test('an emergency-only number is never used as the dispatcher', () => {
  const emergency = { kind: 'phone', label: 'Аварийная служба', value: '112', note: '' };
  assert.equal(contactInformation([emergency]).dispatcher, undefined);
  const office = { ...emergency, label: 'Приёмная', value: '123' };
  assert.equal(contactInformation([emergency, office]).dispatcher, office);
});
