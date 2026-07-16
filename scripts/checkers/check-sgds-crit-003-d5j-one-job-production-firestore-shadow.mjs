import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const runnerPath = 'scripts/production/run-sgds-crit-003-d5j-one-job-firestore-shadow.mjs';
const testPath = 'tests/unit/d5j-one-job-firestore-shadow-runner.test.mjs';
const docPath = 'docs/phases/SGDS_CRIT_003_D5J_ONE_JOB_PRODUCTION_FIRESTORE_SHADOW_WRITE.md';
const runner = read(runnerPath);
const tests = read(testPath);
const doc = fs.existsSync(docPath) ? read(docPath) : '';
const packageJson = JSON.parse(read('package.json'));

const requiredRunnerMarkers = [
  'OWNER_APPROVE_D5J_ONE_JOB_PRODUCTION_FIRESTORE_SHADOW_WRITE',
  'SGDS_D5J_OWNER_APPROVAL',
  'SGDS_D5J_PROJECT_ID',
  'SGDS_D5J_DATABASE_ID',
  'SGDS_D5J_EXPECTED_PRINCIPAL',
  'D5J_GCLOUD_CONFIGURATION',
  '--configuration=sgds-hungdiep',
  'FIRESTORE_EMULATOR_HOST',
  'D5J_PROJECT_ID_DENIED',
  'noble-nation-497005-f1',
  'D5J_ACCOUNT_CONTEXT_MISMATCH',
  'D5J_PRINCIPAL_MISMATCH',
  'D5J_PROJECT_CONTEXT_MISMATCH',
  'D5J_DATABASE_MISMATCH',
  'SGDS_D5J_SYNTHETIC_SHADOW_SMOKE_V1',
  'createFirestoreShadowStateValidator',
  'reconcileDurableInvoiceJobReportOnly',
  'createDurableInvoiceJobStore',
  'createDurableShadowStateIntegration',
  'productionMutationAllowed: false',
  'SHADOW_READY',
  'REPORT_ONLY',
  'inspectD5JExistingTree',
  'commitCreates',
  'D5J_EXISTING_SMOKE_JOB_CONFLICT'
];
for (const marker of requiredRunnerMarkers) {
  assert.match(runner, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5J runner missing marker: ${marker}`);
}

for (const token of [
  'GmailApp',
  'DriveApp',
  'SpreadsheetApp',
  'clasp push',
  'firebase deploy',
  'firestore:rules',
  'databases create',
  'automaticRepair',
  'collectionGroup',
  'recursiveDelete',
  ':runQuery',
  "'DELETE'",
  '"DELETE"'
]) {
  assert.equal(runner.includes(token), false, `D5J runner contains forbidden token: ${token}`);
}

const requiredTestMarkers = [
  'D5J_GUARD_SCENARIOS.length, 30',
  'missing approval rejected',
  'wrong approval rejected',
  'default gcloud context not trusted',
  'sgds-hungdiep configuration required',
  'emulator config rejected',
  'demo project rejected',
  'sanxuat-lt project rejected',
  'Long Thai account rejected',
  'Long Thai project rejected',
  'project mismatch rejected',
  'database mismatch rejected',
  'principal mismatch rejected',
  'forbidden field rejected',
  'raw Gmail ID rejected',
  'raw Drive ID rejected',
  'email rejected',
  'tax code rejected',
  'invoice number rejected',
  'company name rejected',
  'XML/PDF content rejected',
  'productionMutationAllowed=true rejected',
  'production completion status rejected',
  'no broad query',
  'no broad delete',
  'deterministic job ID stable',
  'event IDs deterministic',
  'report ID deterministic',
  'existing exact match is idempotent',
  'existing mismatch is conflict',
  'dry-run performs zero writes'
];
for (const marker of requiredTestMarkers) {
  assert.match(tests, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5J tests missing marker: ${marker}`);
}

const requiredDocMarkers = [
  'D5J_ONE_JOB_PRODUCTION_FIRESTORE_SHADOW_WRITE_STATUS=',
  'RUNNER_ENTRYPOINT=scripts/production/run-sgds-crit-003-d5j-one-job-firestore-shadow.mjs',
  'OWNER_APPROVAL=OWNER_APPROVE_D5J_ONE_JOB_PRODUCTION_FIRESTORE_SHADOW_WRITE',
  'SYNTHETIC_INPUT_ONLY=YES',
  'PRODUCTION_WRITE_PATH_SCOPE=ONE_DETERMINISTIC_JOB_TREE_ONLY',
  'D5D_R_PRODUCTION_SMOKE=POSTPONED_BY_OWNER',
  'SGDS_CRIT_003_STATUS=NOT_FIXED'
];
for (const marker of requiredDocMarkers) {
  assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5J doc missing marker: ${marker}`);
}

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d5j'],
  'node scripts/checkers/check-sgds-crit-003-d5j-one-job-production-firestore-shadow.mjs',
  'package command check:sgds-crit-003-d5j missing or changed'
);

console.log('SGDS_CRIT_003_D5J_CHECK=PASS');
