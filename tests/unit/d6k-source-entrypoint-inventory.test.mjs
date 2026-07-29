import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import { buildD6kSourceEntrypointInventory, sha256, stableInventoryJson } from '../../scripts/analysis/build-d6k-source-entrypoint-inventory.mjs';

const TEST_METADATA = defineTestMetadata({ testClass: 'STATIC_SOURCE_SAFETY', sourceFiles: ['scripts/analysis/build-d6k-source-entrypoint-inventory.mjs'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd6k-inventory-'));
  fs.mkdirSync(path.join(root, 'tests', 'unit'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts', 'checkers'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'Code.js'), `
// function commentedOut() {}
const STORED_HANDLER = 'storedHandler';
const DUPLICATE_NAME = 'one';
function onOpen() {
  SpreadsheetApp.getUi().createMenu('SGDS').addItem('Run', 'runThing').addToUi();
}
async function asyncReader() {
  return Gmail.search('from:test', 0, 1);
}
function doGet() {
  return HtmlService.createHtmlOutput('ok');
}
function runThing() {
  sheet.getRange('A1').setValue('x');
}
function helper_() {
  return 'private';
}
function runD6jCOneRecordProductionMutation() {
  throw new Error('closed');
}
`, 'utf8');
  fs.writeFileSync(path.join(root, 'Other.js'), `
const DUPLICATE_NAME = 'two';
function storedHandler() { return helper_(); }
`, 'utf8');
  fs.writeFileSync(path.join(root, 'Panel.html'), `<button onclick="google.script.run.runThing()">Run</button>`, 'utf8');
  fs.writeFileSync(path.join(root, 'tests', 'unit', 'sample.test.mjs'), `assert.equal(typeof runThing, 'function');`, 'utf8');
  fs.writeFileSync(path.join(root, 'scripts', 'checkers', 'check-sample.mjs'), `const frozen = 'runD6jCOneRecordProductionMutation';`, 'utf8');
  fs.writeFileSync(path.join(root, 'docs', 'operator.md'), `Use storedHandler only as a compatibility wrapper.`, 'utf8');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { check: 'node ok.mjs' } }), 'utf8');
  return root;
}

test('collects normal, async, private, web, menu, html, constant, and duplicate references', () => {
  const inventory = buildD6kSourceEntrypointInventory({ root: makeFixture() });
  const byName = new Map(inventory.functions.map(fn => [fn.name, fn]));

  assert.equal(byName.get('onOpen').classification, 'TRIGGER_HANDLER');
  assert.equal(byName.get('asyncReader').readCapabilities.includes('GMAIL'), true);
  assert.equal(byName.get('doGet').classification, 'WEB_APP_HANDLER');
  assert.equal(byName.get('helper_').classification, 'PRIVATE_HELPER');
  assert.equal(byName.get('runThing').htmlCallers.includes('Panel.html'), true);
  assert.equal(byName.get('runThing').menuCallers.includes('Code.js'), true);
  assert.equal(byName.get('runThing').testCallers.includes('tests/unit/sample.test.mjs'), true);
  assert.equal(byName.get('runThing').mutationCapabilities.includes('SHEETS_WRITE'), true);
  assert.equal(byName.has('commentedOut'), false);
  assert.equal(inventory.collisions.duplicateGlobalVariableNames.some(item => item.name === 'DUPLICATE_NAME'), true);
});

test('finds function names stored in constants and documentation references', () => {
  const inventory = buildD6kSourceEntrypointInventory({ root: makeFixture() });
  const stored = inventory.functions.find(fn => fn.name === 'storedHandler');
  assert.equal(stored.stringBasedCallers.includes('Code.js'), true);
  assert.equal(stored.documentationCallers.includes('docs/operator.md'), true);
  assert.equal(stored.classification, 'COMPATIBILITY_WRAPPER');
});

test('marks historical D6J entrypoints as frozen do not execute', () => {
  const inventory = buildD6kSourceEntrypointInventory({ root: makeFixture() });
  const frozen = inventory.functions.find(fn => fn.name === 'runD6jCOneRecordProductionMutation');
  assert.equal(frozen.classification, 'HISTORICAL_PHASE_ENTRYPOINT');
  assert.equal(frozen.runtimeState, 'FROZEN_DO_NOT_EXECUTE');
  assert.equal(frozen.frozenDoNotExecute, true);
});

test('produces deterministic normalized JSON and hash', () => {
  const root = makeFixture();
  const first = stableInventoryJson(buildD6kSourceEntrypointInventory({ root }));
  const second = stableInventoryJson(buildD6kSourceEntrypointInventory({ root }));
  assert.equal(first, second);
  assert.equal(sha256(first), sha256(second));
});
