import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/_pages/issue-details/ui/issue-details-route.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
function render({ created = '11', cached = true, houseId = '1', view = 'details' } = {}) {
  let loaderCalls = 0;
  const issue = { id: '11', place: { houseId }, mine: true };
  const imports = {
    '@/entities/house': { useHouseSelection: () => ({ house: { id: '1' }, choices: [], choose() {} }) },
    '@/entities/issue': { useIssues: () => ({ issues: cached ? [issue] : [], createdIssueId: created, dismissCreationNotice() {} }) },
    '@/shared/api/context': { useApi: () => { loaderCalls++; return () => Promise.reject(new Error('Unexpected fetch')); } },
    '@/shared/api/use-remote': { useRemote: () => ({ loading: true, error: '', reload() {} }) },
    '@/shared/api/client': { endpoints: { issue: id => '/issues/' + id } },
    '@/shared/api/parse': {},
    '@/entities/issue/model/api-gateway': {},
    './issue-created': { IssueCreated: () => React.createElement('p', null, 'Confirmed creation') },
    './issue-details-page': {}, './issue-not-found-page': {},
    '@/shared/ui/navigation/request-state': { RequestState: () => React.createElement('p', null, 'Loading') },
    '@/features/issue-chat/issue-chat-page': {},
    '@/shared/ui/chat-screen': { ChatScreen: ({ children }) => children },
  };
  const loaded = { exports: {} };
  new Function('require', 'exports', compiled)(name => Object.hasOwn(imports, name) ? imports[name] : require(name), loaded.exports);
  const html = renderToStaticMarkup(React.createElement(loaded.exports.IssueDetailsRoute, { id: '11', view }));
  return { html, loaderCalls };
}

test('a successful creation uses its confirmed server response without a second detail load', () => {
  const result = render();
  assert.match(result.html, /Confirmed creation/);
  assert.doesNotMatch(result.html, /Loading/);
  assert.equal(result.loaderCalls, 0);
});

test('ordinary navigation, absent data and a different house keep their access checks', () => {
  for (const options of [{ created: null }, { cached: false }, { houseId: '2' }, { view: 'chat' }]) {
    const result = render(options);
    assert.match(result.html, /Loading/);
    assert.doesNotMatch(result.html, /Confirmed creation/);
    assert.equal(result.loaderCalls, 1);
  }
});
