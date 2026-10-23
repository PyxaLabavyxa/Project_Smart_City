import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { issueStatusLabels, filterIssues, initialIssueFilters } from '../src/entities/issue/model/issue-filters.ts';

const source = fs.readFileSync(new URL('../src/entities/issue/model/api-gateway.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const gateway = { exports: {} };
const parse = { record: value => value, number: Number, string: String, array: (values, convert) => values.map(convert) };
new Function('require', 'exports', compiled)(name => name === '@/shared/api/parse' ? parse : {}, gateway.exports);

test('all five API states remain distinct in resident filters and history', () => {
  const states = ['new', 'accepted', 'assigned', 'in_progress', 'resolved'];
  const uiStates = ['new', 'accepted', 'assigned', 'in-progress', 'completed'];
  assert.deepEqual(Object.keys(issueStatusLabels), uiStates);
  const issues = states.map((status, index) => gateway.exports.parseIssue({
    id: index + 1, house_id: 1, title: status, description: 'Описание', category: 'water',
    address: 'Солнечная, 1', created_at: '2026-10-23T10:00:00Z', priority: 2, status,
    history: [{ status, at: '2026-10-23T10:00:00Z' }],
  }, { id: '1' }));
  for (const [index, status] of uiStates.entries()) {
    assert.equal(issues[index].history[0].status, status);
    assert.deepEqual(filterIssues(issues, { ...initialIssueFilters, status }).map(issue => issue.id), [String(index + 1)]);
  }
});
