import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatPresence } from '../src/features/issue-chat/presence.ts';

test('only the visible chat sends heartbeats; leaving carries its final read receipt', () => {
  const sent = [];
  const chat = createChatPresence('tab-a', value => sent.push(value));
  chat.update(false, true, null);
  assert.equal(sent.length, 0);
  chat.update(true, true, 10);
  chat.update(true, true, 10);
  assert.equal(sent.length, 1);
  chat.update(true, true, 12);
  chat.update(true, true, 10, true);
  chat.close();
  chat.update(true, true, 15, true);
  assert.deepEqual(sent.map(p => [p.sequence, p.active, p.last_message_id]), [
    [1, true, 10], [2, true, 12], [3, true, 12], [4, false, 12],
  ]);
});

test('a stale history load releases the chat; returning can renew it', () => {
  const sent = [];
  const chat = createChatPresence('tab-b', value => sent.push(value));
  chat.update(true, true, null);
  chat.update(true, false, null, true);
  chat.update(false, true, 99);
  chat.update(true, true, 20);
  chat.close();
  assert.deepEqual(sent.map(p => [p.active, p.last_message_id]), [
    [true, null], [false, null], [true, 20], [false, 20],
  ]);
});
