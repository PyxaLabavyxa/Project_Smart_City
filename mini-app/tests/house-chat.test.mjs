import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHouseChat, safeMaxChatLink, openHouseChat } from '../src/features/select-recipient/model/house-chat.ts';

const link = 'https://max.ru/join/House_1-token';
test('only available groups expose a safe MAX link', () => {
  assert.deepEqual(parseHouseChat({status:'available',title:'Наш дом',join_url:link}), {status:'available',title:'Наш дом',joinUrl:link});
  for (const status of ['not_connected','link_missing','unavailable']) assert.equal(parseHouseChat({status,title:'Чат',join_url:link}).joinUrl,null);
  for (const join_url of [null,'https://evil.example/join/123','javascript:alert(1)','https://max.ru.evil.example/123','https://max.ru@evil.example/123','https://max.ru/join/a?redirect=foo','https://max.ru/join/a\nb']) {
    assert.equal(safeMaxChatLink(join_url),null);
    assert.equal(parseHouseChat({status:'available',title:'Чат',join_url}).status,'link_missing');
  }
  assert.throws(() => parseHouseChat({status:'unexpected',title:'Чат'}));
});
test('native MAX navigation runs synchronously; browsers and old clients retain the anchor fallback', () => {
  let opened;
  assert.equal(openHouseChat(link,{initData:'signed-data',openMaxLink:url=>{opened=url;}}),true);
  assert.equal(opened,link);
  assert.equal(openHouseChat(link),false);
  assert.equal(openHouseChat(link,{openMaxLink:()=>{throw Error('must not call');}}),false);
  assert.equal(openHouseChat(link,{initData:'signed-data',openMaxLink:()=>{throw Error('unsupported');}}),false);
  assert.equal(openHouseChat('javascript:alert(1)',{initData:'signed-data',openMaxLink:()=>{throw Error('must not call');}}),false);
});
