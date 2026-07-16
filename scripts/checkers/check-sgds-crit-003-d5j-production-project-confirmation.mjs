import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const phasePath = 'docs/phases/SGDS_CRIT_003_D5J_PRODUCTION_PROJECT_CONFIRMATION_REVIEW.md';
const evidencePath = 'docs/evidence/SGDS_CRIT_003_D5J_PRODUCTION_PROJECT_CONFIRMATION_BLOCKER.md';
const phase = read(phasePath);
const evidence = read(evidencePath);
const packageJson = JSON.parse(read('package.json'));

const combined = `${phase}\n${evidence}`;

for (const marker of [
  'PHASE_MODE=READ_ONLY_FAIL_CLOSED',
  'D5J_PROJECT_CONFIRMATION_STATUS=BLOCKED_NO_UNIQUE_PRODUCTION_PROJECT',
  'D5J_PRODUCTION_WRITE=NONE',
  'D5J_PRODUCTION_EXECUTION=NOT_RUN_BY_SCOPE',
  'FIREBASE_PROJECT_CREATE=NOT_RUN',
  'FIRESTORE_DATABASE_CREATE=NOT_RUN',
  'FIREBASE_DEPLOY=NOT_RUN',
  'FIRESTORE_RULES_DEPLOY=NOT_RUN',
  'FIRESTORE_INDEX_DEPLOY=NOT_RUN',
  'FIRESTORE_WRITE=NONE',
  'D5J_EXECUTE=NOT_RUN',
  'IAM_CHANGE=NONE',
  'ADC_LOGIN=NOT_RUN',
  'NO_SERVICE_IDENTITY_KEY=YES',
  'NO_LONG_LIVED_CREDENTIAL_KEY_CREATE=YES',
  'NO_LONGTHAI_PROJECT_SELECTION=YES',
  'CONFIRMATION_REQUIRES_TWO_INDEPENDENT_POSITIVE_SOURCES=YES',
  'CANDIDATE_SCORING_DOCUMENTED=YES',
  'BLOCKER_PATH_DOCUMENTED=YES',
  'DEFAULT_LONGTHAI_CONFIGURATION_MODIFIED=NO',
  'NEXT_ALLOWED_PHASE=OWNER_FIREBASE_PROJECT_SELECTION_OR_PROVISIONING_REVIEW'
]) {
  assert.match(combined, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5J-P evidence missing marker: ${marker}`);
}

for (const forbidden of [
  'firebase projects:create',
  'gcloud projects create',
  'gcloud firestore databases create',
  'gcloud services enable',
  'gcloud iam ',
  'gcloud auth application-default login',
  'firebase deploy',
  'firestore:rules',
  'firestore:indexes',
  'clasp push',
  'D5J_PRODUCTION_EXECUTION=RUN',
  'FIRESTORE_WRITE=YES',
  'noble-nation-497005-f1 selected',
  'sanxuatlt selected'
]) {
  assert.equal(combined.includes(forbidden), false, `D5J-P evidence contains forbidden marker: ${forbidden}`);
}

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d5j-project-confirmation'],
  'node scripts/checkers/check-sgds-crit-003-d5j-production-project-confirmation.mjs',
  'package command check:sgds-crit-003-d5j-project-confirmation missing or changed'
);

console.log('SGDS_CRIT_003_D5J_PROJECT_CONFIRMATION_CHECK=PASS');
