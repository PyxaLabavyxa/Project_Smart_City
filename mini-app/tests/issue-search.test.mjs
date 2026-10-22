import test from 'node:test';
import assert from 'node:assert/strict';
import { initialIssueFilters, issueFiltersFromSearch, issueFiltersSearch } from '../src/entities/issue/model/issue-filters.ts';

test('issue query, tab and combined filters survive URL round trips', () => {
  const filters = { status: 'active', category: 'Электричество', entrance: '2', floor: '9', zone: 'corridor', query: 'свет & лифт', onlyMine: true };
  const search = new URLSearchParams(issueFiltersSearch(filters, '1'));
  assert.deepEqual(issueFiltersFromSearch(search, '1'), filters);
  assert.deepEqual(issueFiltersFromSearch(search, '2'), initialIssueFilters);
});

test('existing category links and mine links work without a house parameter', () => {
  assert.equal(issueFiltersFromSearch(new URLSearchParams('mine=1'), '1').onlyMine, true);
  assert.equal(issueFiltersFromSearch(new URLSearchParams({ category: 'Лифт' }), '1').category, 'Лифт');
  assert.equal(issueFiltersFromSearch(new URLSearchParams('status=unknown'), '1').status, 'all');
});
