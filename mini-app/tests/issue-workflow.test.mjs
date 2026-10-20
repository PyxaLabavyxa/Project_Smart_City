import test from 'node:test';
import assert from 'node:assert/strict';
import { demoIssues } from './fixtures/issues.ts';
import { houseHealthScore } from '../src/entities/issue/model/issue-workflow.ts';
import { filterIssues, initialIssueFilters } from '../src/entities/issue/model/issue-filters.ts';

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
