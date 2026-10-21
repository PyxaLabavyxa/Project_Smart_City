import test from 'node:test';
import assert from 'node:assert/strict';
import { demoIssues } from './fixtures/issues.ts';
import { houseHealthScore } from '../src/entities/issue/model/issue-workflow.ts';
import { filterIssues, initialIssueFilters, selectIssueTab } from '../src/entities/issue/model/issue-filters.ts';

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

test('my issues tab includes both active and completed issues authored by the resident', () => {
  const filters = selectIssueTab(initialIssueFilters, 'mine');
  assert.deepEqual(filterIssues(demoIssues, filters).map(issue => issue.id), ['149', '146']);
  assert.deepEqual(filterIssues(demoIssues, { ...filters, status: 'completed' }).map(issue => issue.id), ['146']);
  assert.deepEqual(filterIssues(demoIssues, { ...filters, query: 'ремонт', category: 'Уборка' }).map(issue => issue.id), ['149']);
  assert.deepEqual(filterIssues(demoIssues.map(issue => ({ ...issue, mine: false })), filters), []);
});

test('switching between all and my issues preserves status, search and place filters', () => {
  const mine = selectIssueTab({ ...initialIssueFilters, status: 'active', entrance: '2', query: 'доводчик' }, 'mine');
  assert.deepEqual(filterIssues(demoIssues, mine), []);
  const active = selectIssueTab(mine, 'all');
  assert.equal(active.status, 'active');
  assert.equal(active.entrance, '2');
  assert.equal(active.query, 'доводчик');
  assert.equal(active.onlyMine, false);
  assert.deepEqual(filterIssues(demoIssues, active).map(issue => issue.id), ['150']);
  assert.equal(filterIssues(demoIssues, selectIssueTab(initialIssueFilters, 'all')).length, demoIssues.length);
  const completed = selectIssueTab({ ...initialIssueFilters, status: 'completed' }, 'mine');
  assert.equal(completed.status, 'completed');
  assert.deepEqual(filterIssues(demoIssues, completed).map(issue => issue.id), ['146']);
  assert.equal(selectIssueTab(completed, 'all').status, 'completed');
});
