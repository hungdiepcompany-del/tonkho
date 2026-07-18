import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const currentDocs = [
  'docs/02_TARGET_ARCHITECTURE.md',
  'docs/phases/SGDS_D5Y_D5Z_D6A_D6B_APPS_SCRIPT_FIRST_FOUNDATION.md'
];

for (const file of currentDocs) assert.equal(exists(file), true, `missing architecture doc: ${file}`);

const combined = currentDocs.map(read).join('\n');

for (const marker of [
  'SGDS_RUNTIME_STRATEGY=APPS_SCRIPT_FIRST_NO_BILLING',
  'PRIMARY_WORKER=GOOGLE_APPS_SCRIPT',
  'FILE_STORE=GOOGLE_DRIVE',
  'BUSINESS_LEDGER=GOOGLE_SHEETS',
  'CONTROL_PLANE=FIRESTORE',
  'FRONTEND=FIREBASE_HOSTING_STATIC',
  'AUTHENTICATION=FIREBASE_AUTH_GOOGLE',
  'BILLING_REQUIRED=NO',
  'CLOUD_RUN_STATUS=DEFERRED_OPTIONAL',
  'CLOUD_RUN_PRIMARY_PATH=NO',
  'CLOUD_RUN_BLOCKER_FOR_CURRENT_ROADMAP=NO',
  'CLOUD_RUN_CODE_RETAINED=YES_OPTIONAL_ADAPTER'
]) {
  assert.equal(combined.includes(marker), true, `missing architecture marker: ${marker}`);
}

for (const forbidden of [
  'BILLING_REQUIRED=YES',
  'CLOUD_RUN_PRIMARY_PATH=YES',
  'CLOUD_RUN_STATUS=MANDATORY',
  'Docker is required for the active roadmap',
  'Artifact Registry is required for the active roadmap',
  'Cloud Build is required for the active roadmap'
]) {
  assert.equal(combined.includes(forbidden), false, `current architecture must not make deferred infrastructure mandatory: ${forbidden}`);
}

const historicalDoc = read('docs/phases/SGDS_D5S_D5X_CLOUD_RUN_BUILD_DEPLOY_REVIEW.md');
assert.equal(historicalDoc.includes('SGDS_CLOUD_RUN_BUILD_DEPLOY_REVIEW_STATUS='), true, 'historical D5S-D5X doc must remain present');

console.log('SGDS_APPS_SCRIPT_FIRST_ARCHITECTURE_CHECK=PASS');
