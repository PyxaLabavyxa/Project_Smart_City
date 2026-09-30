import test from "node:test";
import assert from "node:assert/strict";
import { healthHistory } from "../src/entities/issue/model/health-history.ts";

const now = new Date("2026-09-30T12:00:00+03:00");
test("history follows creation, completion and reopening rather than today's status", () => {
  const points = healthHistory([{ createdAt: "2026-09-10T09:00:00+03:00", status: "in-progress", priority: "high", history: [
    { at: "2026-09-10T09:00:00+03:00", status: "new" },
    { at: "2026-09-15T09:00:00+03:00", status: "completed" },
    { at: "2026-09-20T09:00:00+03:00", status: "in-progress" },
  ] }], now);
  assert.equal(points.length, 30);
  assert.equal(points[8].score, 100);
  assert.equal(points[9].score, 90);
  assert.equal(points[14].score, 100);
  assert.equal(points[19].score, 90);
  assert.equal(points[29].score, 90);
});
test("missing history is a gap, while the current known score is preserved", () => {
  const points = healthHistory([{ createdAt: "2026-09-10T00:00:00+03:00", status: "completed", history: [] }], now);
  assert.equal(points[8].score, 100);
  assert.equal(points[9].score, null);
  assert.equal(points[29].score, 100);
});
test("Moscow day boundaries and the lower score bound are respected", () => {
  const issues = Array.from({ length: 40 }, () => ({ createdAt: "2026-09-09T22:30:00Z", status: "new", history: [{ at: "2026-09-09T22:30:00Z", status: "new" }] }));
  const points = healthHistory(issues, now);
  assert.equal(points[8].score, 100);
  assert.equal(points[9].score, 0);
  assert.equal(points[29].score, 0);
});
