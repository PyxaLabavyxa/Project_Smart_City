import test from 'node:test';
import assert from 'node:assert/strict';
import { contactHref } from '../src/entities/management-company/model/contacts.ts';

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
