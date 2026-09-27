import test from 'node:test';
import assert from 'node:assert/strict';
import { demoIssues } from '../src/entities/issue/model/demo-issues.ts';
import { withStatus, resolvedDelta, houseHealthScore } from '../src/entities/issue/model/issue-workflow.ts';
import { filterIssues, initialIssueFilters } from '../src/entities/issue/model/issue-filters.ts';

test('reopening appends repeated statuses without replacing the earlier history', () => {
  const original = demoIssues.find(issue => issue.id === '149');
  const reopened = withStatus(original, 'in-progress', '2026-09-27T12:00:00Z');
  assert.equal(reopened.history.length, original.history.length + 1);
  assert.equal(reopened.history.filter(event => event.status === 'in-progress').length, 2);
  assert.deepEqual(reopened.history.slice(0, -1), original.history);
  assert.equal(original.status, 'awaiting-confirmation');
  assert.equal(withStatus(reopened, 'in-progress', '2026-09-27T13:00:00Z'), reopened);
});

test('confirmed resolutions update health and reopening reverses the change', () => {
  assert.equal(houseHealthScore(demoIssues), 82);
  const confirmed = demoIssues.map(issue => issue.id === '149' ? withStatus(issue, 'completed', '2026-09-27T12:00:00Z') : issue);
  assert.equal(houseHealthScore(confirmed), 85);
  assert.equal(resolvedDelta(confirmed, 'Уборка'), 1);
  assert.equal(resolvedDelta(confirmed, 'Водоснабжение'), 0);
  const reopened = confirmed.map(issue => issue.id === '149' ? withStatus(issue, 'in-progress', '2026-09-27T13:00:00Z') : issue);
  assert.equal(houseHealthScore(reopened), 82);
});

test('filters combine ownership, status and place, with a recoverable empty result', () => {
  const mine = filterIssues(demoIssues, { ...initialIssueFilters, onlyMine: true, status: 'active', entrance: '2', floor: '9' });
  assert.deepEqual(mine.map(issue => issue.id), ['149']);
  assert.deepEqual(filterIssues(demoIssues, { ...initialIssueFilters, query: '  СТОЯКА  ', zone: 'corridor', category: 'Водоснабжение' }).map(issue => issue.id), ['148']);
  assert.equal(filterIssues(demoIssues, { ...initialIssueFilters, query: 'нет-такого-обращения' }).length, 0);
  assert.equal(filterIssues(demoIssues, initialIssueFilters).length, demoIssues.length);
});
