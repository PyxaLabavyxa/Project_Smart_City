import test from 'node:test';
import assert from 'node:assert/strict';
import { readingError, applyReading, totalCharges } from '../src/entities/utilities/model.ts';
import { messageThreads } from '../src/entities/message/model/threads.ts';

test('readings accept decimal comma and zero consumption, reject decreasing or malformed values', () => {
  assert.equal(readingError('124,6', 124.6), undefined);
  assert.equal(readingError('125.001', 124.6), undefined);
  for (const value of ['', '-1', '124.5', 'Infinity', '1e8', '125.0001', '10000000']) assert.ok(readingError(value, 124.6));
});
test('readings can only change values of registered meters, not their identity', () => {
  const account = { meters: [{ id: '1', kind: 'cold', serial: 'ХВ-104821', previous: 124.6 }] };
  assert.throws(() => applyReading(account, 'unknown', '130'));
  assert.throws(() => applyReading(account, '1', '100'));
  const updated = applyReading(account, '1', '130,1');
  assert.deepEqual(updated.meters[0], { ...account.meters[0], current: 130.1 });
  assert.equal(account.meters[0].current, undefined);
});
test('invoice totals use integer kopecks', () => {
  assert.equal(totalCharges([{ amount: 19280 }, { amount: 26950 }, { amount: 96560 }]), 142790);
  assert.equal(totalCharges([]), 0);
});
test('threads retain the latest message per apartment and sort by activity', () => {
  const messages = [
    { id: 'a', apartment: 69, createdAt: '2026-09-23T10:00:00Z' },
    { id: 'b', apartment: 70, createdAt: '2026-09-25T10:00:00Z' },
    { id: 'c', apartment: 69, createdAt: '2026-09-26T10:00:00Z' },
  ];
  assert.deepEqual(messageThreads(messages).map(message => message.id), ['c', 'b']);
  assert.equal(messages.length, 3);
  assert.deepEqual(messageThreads([]), []);
});
