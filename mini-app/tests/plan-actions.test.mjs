import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as houseModel from '../src/entities/house/model/house.ts';
import { conversationHref } from '../src/shared/api/conversation-route.ts';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/features/explore-house/ui/house-explorer.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
const house = { id: '1', address: 'Солнечная, 1', entrances: 2, floors: 9, apartmentsPerFloor: 4, residentApartment: 7, residentApartmentId: 7 };
const choices = [{ id: 7, houseId: '1', apartment: 7 }, { id: 15, houseId: '1', apartment: 15 }, { id: 108, houseId: '3', apartment: 8 }];
const place = apartment => houseModel.findApartment(house, apartment);

function actions(selected, memberships = choices, remembered = false) {
  const imports = {
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/shared/api/conversation-route': { conversationHref },
    '@/entities/house': { ...houseModel, useHouseSelection: () => ({ house, choices: memberships, selected, select() {} }), FloorControls: () => null, FloorPlan: () => null },
    '@/entities/issue': { useIssues: () => ({ issues: [], startAt() {} }), IssueList: () => null },
    './house-explorer.module.css': { __esModule: true, default: {} },
  };
  const loaded = { exports: {} };
  new Function('require', 'exports', compiled)(name => Object.hasOwn(imports, name) ? imports[name] : require(name), loaded.exports);
  return renderToStaticMarkup(React.createElement(loaded.exports.HouseExplorer, remembered ? {} : { initialPlace: selected }));
}

test('a neighbour selected from the plan offers messaging without starting an issue', () => {
  const html = actions(place(8));
  assert.doesNotMatch(html, /Сообщить о проблеме|href="\/issues\/new/);
  assert.match(html, /Написать в квартиру 8/);
  assert.match(html, /href="\/messages\/8\?from=7"/);
});

test('a remembered neighbour and a same-number apartment in another house remain foreign', () => {
  assert.doesNotMatch(actions(place(8), choices, true), /Сообщить о проблеме/);
});

test('every owned apartment in this house offers reporting without messaging oneself', () => {
  for (const number of [7, 15]) {
    const html = actions(place(number));
    assert.match(html, /Сообщить о проблеме/);
    assert.doesNotMatch(html, /Написать в квартиру/);
  }
});

test('a removed membership does not keep reporting available for the former current apartment', () => {
  assert.doesNotMatch(actions(place(7), choices.filter(choice => choice.id !== 7)), /Сообщить о проблеме/);
});

test('common areas keep reporting and cameras without apartment messaging', () => {
  for (const zone of Object.keys(houseModel.commonZones)) {
    const html = actions({ houseId: '1', entrance: 1, floor: 1, zone });
    assert.match(html, /Сообщить о проблеме/);
    assert.match(html, /Камеры дома/);
    assert.doesNotMatch(html, /Написать в квартиру/);
  }
});


test('old outdoor plan links show an indoor floor without territory tabs or an outdoor room card', () => {
  for (const zone of ['house', 'courtyard', 'parking']) {
    const html = actions({ houseId:'1', entrance:1, floor:1, zone });
    assert.doesNotMatch(html, /Другие зоны дома|Перейти к этажам дома|Общая территория|>Двор<|>Парковка</);
    assert.match(html, /Этаж 2/);
    assert.match(html, /Коридор/);
  }
});
