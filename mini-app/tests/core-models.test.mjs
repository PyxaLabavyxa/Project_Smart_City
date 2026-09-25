import test from "node:test";
import assert from "node:assert/strict";
import { floorApartments, findApartment, totalApartments, sameLocation } from "../src/entities/house/model/house.ts";
import { demoHouse } from "../src/entities/house/model/demo-house.ts";
import { demoIssues } from "../src/entities/issue/model/demo-issues.ts";
import { filterIssues, initialIssueFilters } from "../src/entities/issue/model/issue-filters.ts";

test("apartment numbers are continuous and reversible across entrances and floors", () => {
  for (const perFloor of [1, 4, 5, 7]) {
    const house = { ...demoHouse, apartmentsPerFloor: perFloor };
    const all = [];
    for (let entrance = 1; entrance <= house.entrances; entrance++) {
      for (let floor = 1; floor <= house.floors; floor++) {
        for (const apartment of floorApartments(house, entrance, floor)) {
          all.push(apartment);
          assert.deepEqual(findApartment(house, apartment), { houseId: house.id, entrance, floor, zone: "apartment", apartment });
        }
      }
    }
    assert.deepEqual(all, Array.from({ length: totalApartments(house) }, (_, index) => index + 1));
  }
  assert.deepEqual(floorApartments(demoHouse, 2, 9), [69, 70, 71, 72]);
  assert.equal(findApartment(demoHouse, 37).entrance, 2);
});

test("invalid floor and apartment selections cannot produce phantom apartments", () => {
  for (const number of [0, -1, 73, 1.5, NaN, Infinity]) assert.equal(findApartment(demoHouse, number), null);
  for (const [entrance, floor] of [[0, 1], [3, 1], [1, 0], [1, 10], [1.5, 2]]) {
    assert.deepEqual(floorApartments(demoHouse, entrance, floor), []);
  }
});

test("rooms match by house, entrance, floor and apartment rather than label alone", () => {
  const room = findApartment(demoHouse, 69);
  assert.equal(sameLocation(room, { ...room }), true);
  assert.equal(sameLocation(room, findApartment(demoHouse, 70)), false);
  assert.equal(sameLocation({ ...room, houseId: "another" }, room), false);
  assert.equal(sameLocation(undefined, room), false);
  const corridor = { houseId: demoHouse.id, entrance: 2, floor: 9, zone: "corridor" };
  assert.equal(sameLocation(demoIssues.find(issue => issue.id === "148").place, corridor), true);
  assert.equal(sameLocation(corridor, { ...corridor, floor: 8 }), false);
});

test("filters combine status, category and structured location without mutating data", () => {
  const snapshot = JSON.stringify(demoIssues);
  const filters = { ...initialIssueFilters, status: "active", category: "Водоснабжение", entrance: "2", floor: "9", zone: "corridor" };
  assert.deepEqual(filterIssues(demoIssues, filters).map(issue => issue.id), ["148"]);
  assert.equal(filterIssues(demoIssues, { ...filters, floor: "8" }).length, 0);
  assert.equal(filterIssues(demoIssues, initialIssueFilters).length, demoIssues.length);
  assert.equal(JSON.stringify(demoIssues), snapshot);
});

test("search handles free-text local reports, whitespace and letter case", () => {
  const local = { ...demoIssues[0], id: "local", location: "Двор у ворот", place: undefined };
  assert.equal(filterIssues([local], { ...initialIssueFilters, query: "  ДВОР  " }).length, 1);
  assert.equal(filterIssues([local], { ...initialIssueFilters, entrance: "2" }).length, 0);
});

test("completed and additional workflow statuses filter consistently", () => {
  const issues = ["new", "accepted", "assigned", "in-progress", "awaiting-confirmation", "completed"].map(status => ({ ...demoIssues[0], id: status, status }));
  assert.equal(filterIssues(issues, { ...initialIssueFilters, status: "active" }).length, 5);
  for (const issue of issues) assert.deepEqual(filterIssues(issues, { ...initialIssueFilters, status: issue.status }).map(item => item.id), [issue.id]);
});
