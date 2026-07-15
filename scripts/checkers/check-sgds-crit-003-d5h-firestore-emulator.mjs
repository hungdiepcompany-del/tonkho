import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const adapterPath = 'firestoreEmulatorDurableShadowIntegration.js';
const testPath = 'tests/emulator/firestore-shadow-emulator.test.mjs';
const runnerPath = 'scripts/test/run-firestore-emulator-tests.mjs';
const docPath = 'docs/phases/SGDS_CRIT_003_D5H_FIRESTORE_EMULATOR_INTEGRATION.md';
const pkg = JSON.parse(read('package.json'));

const adapter = read(adapterPath);
const tests = read(testPath);
const runner = read(runnerPath);
const doc = read(docPath);

const requiredAdapterMarkers = [
  'function createFirestoreEmulatorDurableShadowIntegration(options)',
  'validateFirestoreShadowEmulatorConfig',
  'createFirestoreShadowJobStoreAdapter',
  'createDurableInvoiceJobStore',
  'createDurableShadowStateIntegration',
  'FIRESTORE_EMULATOR_HOST_REQUIRED',
  'FIRESTORE_EMULATOR_PROJECT_ID_REQUIRED',
  'PRODUCTION_LIKE_FIRESTORE_PROJECT_DENIED',
  'SGDS_D5H_PRODUCTION_FIRESTORE_ACCESS_',
  "'NONE'",
  'SGDS_D5H_PRODUCTION_WRITE_EXECUTED_',
  'false'
];
for (const marker of requiredAdapterMarkers) {
  assert.match(adapter, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5H adapter missing marker: ${marker}`);
}

const requiredTestMarkers = [
  'D5H_EMULATOR_SCENARIOS.length, 30',
  'D5H_CONCURRENCY_SCENARIOS.length, 6',
  'D5H_FAULT_INJECTION_CASES.length, 10',
  'create deterministic shadow job',
  'same candidate reuses same job',
  'Gmail and Drive sources converge',
  'same idempotency key does not duplicate event',
  'normal client write denied by rules',
  'anonymous access denied',
  'productionMutationAllowed=true denied',
  'shadow production completion state denied'
];
for (const marker of requiredTestMarkers) {
  assert.match(tests, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5H tests missing marker: ${marker}`);
}

assert.match(runner, /FIRESTORE_EMULATOR_HOST/, 'D5H runner must set emulator host');
assert.match(runner, /demo-sgds-local/, 'D5H runner must set demo/local project');
assert.equal(pkg.scripts['test:firestore-emulator'], 'node scripts/test/run-firestore-emulator-tests.mjs');
assert.equal(pkg.scripts['check:sgds-crit-003-d5h'], 'node scripts/checkers/check-sgds-crit-003-d5h-firestore-emulator.mjs');

const requiredDocMarkers = [
  'D5H_EMULATOR_STATUS=PASS',
  'EMULATOR_PROJECT_ID=demo-sgds-local',
  'EMULATOR_GUARD=PASS',
  'PRODUCTION_FIRESTORE_ACCESS=NONE',
  'PRODUCTION_FIRESTORE_WRITE=NONE',
  'EMULATOR_TEST_COUNT=30',
  'CONCURRENCY_SCENARIO_COUNT=6',
  'FAULT_INJECTION_COUNT=10',
  'RULES_TEST_RESULT=PASS',
  'EMULATOR_INTEGRATION_RESULT=PASS'
];
for (const marker of requiredDocMarkers) {
  assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5H doc missing marker: ${marker}`);
}

for (const token of ['GmailApp', 'DriveApp', 'SpreadsheetApp', 'firestore.googleapis.com', 'firebase deploy', 'clasp push', 'automaticRepair']) {
  assert.equal(adapter.includes(token), false, `D5H adapter contains forbidden token: ${token}`);
}

console.log('SGDS_CRIT_003_D5H_CHECK=PASS');
