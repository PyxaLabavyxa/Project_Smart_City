import test from 'node:test';
import assert from 'node:assert/strict';
import { demoIssues } from './fixtures/issues.ts';
import { houseHealthScore } from '../src/entities/issue/model/issue-workflow.ts';
import { filterIssues, initialIssueFilters, categoriesForFloor, issueCategories } from '../src/entities/issue/model/issue-filters.ts';

test('entrance and yard categories are available only on the first floor', () => {
  assert.deepEqual(categoriesForFloor(1), issueCategories);
  for (const floor of [2, 9, 40]) {
    const categories = categoriesForFloor(floor);
    assert.equal(categories.includes('Подъезд'), false);
    assert.equal(categories.includes('Двор'), false);
    assert.equal(categories.includes('Водоснабжение'), true);
    assert.equal(categories.includes('Другое'), true);
  }
});

test('health indicator uses actual open issues and priority', () => {
  assert.equal(houseHealthScore([]), 100);
  assert.equal(houseHealthScore([{ status: 'new' }, { status: 'in-progress', priority: 'high' }, { status: 'completed', priority: 'high' }]), 87);
  assert.equal(houseHealthScore(Array.from({length: 40}, () => ({status: 'new'}))), 0);
});
test('filters combine ownership, status and place', () => {
  const mine = filterIssues(demoIssues, { ...initialIssueFilters, onlyMine: true, status: 'active', entrance: '2', floor: '9' });
  assert.deepEqual(mine.map(issue => issue.id), ['149']);
  assert.equal(filterIssues(demoIssues, { ...initialIssueFilters, query: 'нет-такого-обращения' }).length, 0);
});
