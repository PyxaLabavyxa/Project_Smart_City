import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/widgets/application-shell/ui/application-shell.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
function render(pathname, { created = '11', houseId = '1' } = {}) {
  const imports = {
    'next/navigation': { usePathname: () => pathname },
    'next/link': { __esModule: true, default: ({ children, prefetch, ...props }) => { void prefetch; return React.createElement('a', props, children); } },
    './bottom-navigation': { BottomNavigation: () => null },
    './shell.module.css': { __esModule: true, default: {} },
    '@/shared/ui/brand-mark': { BrandWordmark: () => null },
    '@/shared/ui/artwork-assets': { appIcon: { src: '/test.webp' } },
    '@/shared/ui/icon': { Icon: () => null },
    '@/entities/house/ui/apartments-ready': { ApartmentsReady: ({ children }) => children },
    '@/features/notifications/provider': { NotificationBell: () => null },
    '@/entities/house': { useHouseSelection: () => ({ house: { id: '1' } }) },
    '@/entities/issue': { useIssues: () => ({ createdIssueId: created, issues: [{ id: '11', place: { houseId } }], dismissCreationNotice() {} }) },
    '@/features/report-issue/ui/issue-created': { IssueCreated: () => React.createElement('p', { 'data-issue-created': true }, 'Confirmed creation') },
  };
  const loaded = { exports: {} };
  new Function('require', 'exports', compiled)(name => Object.hasOwn(imports, name) ? imports[name] : require(name), loaded.exports);
  return renderToStaticMarkup(React.createElement(loaded.exports.ApplicationShell, null, React.createElement('p', null, 'Route is loading')));
}

test('confirmed creation remains visible while the form-to-detail route is loading', () => {
  for (const path of ['/issues/new', '/issues/11']) {
    const html = render(path);
    assert.match(html, /Confirmed creation/);
    assert.doesNotMatch(html, /Route is loading/);
  }
});

test('creation feedback does not cover other pages, another house or unconfirmed sending', () => {
  for (const [path, options] of [['/issues/new', { created: null }], ['/issues/new', { houseId: '2' }], ['/issues/12', {}], ['/issues/11/chat', {}], ['/', {}]]) {
    const html = render(path, options);
    assert.doesNotMatch(html, /Confirmed creation/);
    assert.match(html, /Route is loading/);
  }
});
