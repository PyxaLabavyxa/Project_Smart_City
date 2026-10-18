import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeMessages, parseChatMessage } from '../src/features/issue-chat/model.ts';

const row = (id, direction = 'staff') => ({ id, direction, author: 'Анна', text: 'Ответ', created_at: '2026-10-18T10:00:00Z' });

test('a delayed history read preserves an already sent message and orders replies', () => {
  const sent = parseChatMessage(row(3, 'resident'));
  const merged = mergeMessages([sent], [parseChatMessage(row(1)), parseChatMessage(row(2))]);
  assert.deepEqual(merged.map(m => m.id), [1, 2, 3]);
  assert.equal(merged[2], sent);
  assert.equal(mergeMessages(merged, [sent]).length, 3);
});

test('chat parser accepts both authors and rejects malformed messages', () => {
  assert.equal(parseChatMessage(row(1)).direction, 'staff');
  assert.equal(parseChatMessage(row(2, 'resident')).createdAt, row(2).created_at);
  for (const changes of [{id: 0}, {direction: 'other'}, {created_at: 'bad'}, {text: null}]) {
    assert.throws(() => parseChatMessage({...row(1), ...changes}));
  }
});
