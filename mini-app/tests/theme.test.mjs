import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { themeBootstrap } from '../src/features/settings/theme-bootstrap.ts';

function boot(preference, systemDark, blocked = false) {
  const metas = { 'theme-color': {}, 'color-scheme': {} };
  const root = { dataset: {}, style: {} };
  vm.runInNewContext(themeBootstrap, {
    localStorage: { getItem() { if (blocked) throw new Error('Storage unavailable'); return preference; } },
    matchMedia: () => ({ matches: systemDark }),
    document: { documentElement: root, querySelector(selector) {
      return { setAttribute(name, value) { metas[selector.includes('theme-color') ? 'theme-color' : 'color-scheme'][name] = value; } };
    } },
  });
  return { root, metas };
}

test('explicit light theme blocks automatic darkening even on a dark device', () => {
  const { root, metas } = boot('light', true);
  assert.equal(root.dataset.theme, 'light');
  assert.equal(root.style.colorScheme, 'only light');
  assert.equal(metas['color-scheme'].content, 'only light');
});

test('dark and system themes resolve before hydration, including blocked storage', () => {
  for (const [preference, systemDark, blocked, expected] of [
    ['dark', false, false, 'dark'], ['system', true, false, 'dark'],
    [null, false, false, 'light'], [null, true, true, 'dark'],
  ]) {
    const { root, metas } = boot(preference, systemDark, blocked);
    assert.equal(root.dataset.theme, expected);
    assert.equal(root.style.colorScheme, expected === 'dark' ? 'dark' : 'only light');
    assert.equal(metas['theme-color'].content, expected === 'dark' ? '#091f2c' : '#f1f9fc');
  }
});
