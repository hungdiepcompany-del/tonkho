import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const evidencePath = 'docs/phases/SGDS_CRIT_003_D5J_I_D5L_PRODUCTION_SYNTHETIC_SHADOW_SMOKE_RESULT.md';
const artifactPath = 'artifacts/releases/sgds-crit-003-d5j-i-d5l-production-synthetic-shadow-smoke-sanitized.txt';
const packageJson = JSON.parse(read('package.json'));
const evidence = read(evidencePath);
const artifact = read(artifactPath);

const requiredEvidenceMarkers = [
  'SGDS_D5J_I_D5L_CONTINUATION_STATUS=PASS_MANUAL_PRODUCTION_SHADOW_SMOKE',
  'OWNER_APPROVAL_1=OWNER_APPROVE_D5J_ONE_JOB_PRODUCTION_FIRESTORE_SHADOW_WRITE',
  'OWNER_APPROVAL_2=OWNER_APPROVE_D5J_SAME_CASE_IDEMPOTENCY_REPLAY',
  'FIREBASE_PROJECT=tonkhohd',
  'FIRESTORE_DATABASE=(default)',
  'RULES_RELEASE=projects/tonkhohd/releases/cloud.firestore',
  'RULESET=projects/tonkhohd/rulesets/c374105c-31a8-4bb7-bf2b-3a981c35c142',
  'RULES_PARITY=PASS',
  'WRITE_PRINCIPAL=hungdiepcompany@gmail.com',
  'WRITE_PRINCIPAL_ROLES=roles/firebaserules.viewer,roles/owner',
  'PRODUCTION_AUTOMATION_PRINCIPAL_READY=NO',
  'LEAST_PRIVILEGE_AUTOMATION=NOT_READY',
  'SYNTHETIC_CASE_ID=SGDS_D5J_SYNTHETIC_SHADOW_SMOKE_V1',
  'SYNTHETIC_JOB_ID=sgds-d5j-3400731da7823d5d8690f242',
  'SYNTHETIC_JOB_PATH=invoiceJobs/sgds-d5j-3400731da7823d5d8690f242',
  'SOURCE=synthetic',
  'ENVIRONMENT=production-shadow-smoke',
  'BUSINESS_DATA=false',
  'CANONICAL_WRITE_ALLOWED=false',
  'REAL_SOURCE_IDENTIFIERS=NONE',
  'D5J_I_ONE_JOB_WRITE=PASS',
  'D5J_J_IDEMPOTENCY_REPLAY=PASS',
  'JOB_COUNT_AFTER_REPLAY=1',
  'DUPLICATE_JOB_COUNT=0',
  'IDEMPOTENCY_KEY_UNCHANGED=YES',
  'IMMUTABLE_FIELDS_UNCHANGED=YES',
  'STATE_REGRESSION=NO',
  'D5K_A_RETRY_CONTRACT=PASS_EMULATOR_AND_PRODUCTION_READ_ONLY',
  'PRODUCTION_RETRY_MUTATION=NOT_RUN_NOT_APPROVED',
  'D5K_B_RECONCILIATION=PASS_READ_ONLY',
  'RECONCILIATION_STATUS=CONSISTENT',
  'D5K_C_AUDIT_STATE_MACHINE=PASS',
  'AUDIT=PASS',
  'STATE_MACHINE=PASS',
  'FIRESTORE_DOCUMENTS_CREATED=6',
  'FIRESTORE_DOCUMENTS_UPDATED=0',
  'FIRESTORE_DOCUMENTS_DELETED=0',
  'REAL_FIRESTORE_DOCUMENTS_MUTATED=0',
  'GOOGLE_SHEETS_MUTATION=NONE',
  'GMAIL_MESSAGE_MUTATION=NONE',
  'GMAIL_LABEL_MUTATION=NONE',
  'GOOGLE_DRIVE_MUTATION=NONE',
  'FIRESTORE_RULES_DEPLOY=NOT_RUN_IN_THIS_PHASE',
  'FIREBASE_HOSTING_DEPLOY=NOT_RUN',
  'GAS_DEPLOY=NOT_RUN',
  'SYNTHETIC_CLEANUP=NOT_RUN_APPROVAL_MISSING',
  'SYNTHETIC_EVIDENCE_RETAINED=YES',
  'SGDS_CRIT_003_STATUS=PARTIALLY_CLOSED_PRODUCTION_AUTOMATION_PRINCIPAL_PENDING',
  'SGDS_CRIT_003_LIMITATION=NO_DISTRIBUTED_ACID_TRANSACTION_ACROSS_GMAIL_DRIVE_SHEETS_LABELS',
  'NEXT_ALLOWED_ACTION=DEDICATED_FIRESTORE_RUNTIME_IDENTITY_AND_LEAST_PRIVILEGE_IAM'
];

for (const marker of requiredEvidenceMarkers) {
  assert.match(evidence, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5J-D5L evidence missing marker: ${marker}`);
}

for (const marker of [
  'SGDS_D5J_I_D5L_CONTINUATION_STATUS=PASS_MANUAL_PRODUCTION_SHADOW_SMOKE',
  'SYNTHETIC_JOB_ID=sgds-d5j-3400731da7823d5d8690f242',
  'IDEMPOTENCY=PASS',
  'REAL_FIRESTORE_DOCUMENTS_MUTATED=0',
  'SGDS_CRIT_003_STATUS=PARTIALLY_CLOSED_PRODUCTION_AUTOMATION_PRINCIPAL_PENDING'
]) {
  assert.match(artifact, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5J-D5L artifact missing marker: ${marker}`);
}

for (const forbidden of [
  ['ya29', '.'].join(''),
  `refresh_${'token'}`,
  `private_${'key'}`,
  'Gmail thread ID',
  'Drive file ID',
  'taxCode=',
  'invoiceNo=',
  '<Invoice',
  'JVBER'
]) {
  assert.equal(evidence.includes(forbidden), false, `D5J-D5L evidence contains forbidden token: ${forbidden}`);
  assert.equal(artifact.includes(forbidden), false, `D5J-D5L artifact contains forbidden token: ${forbidden}`);
}

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d5j-d5l-production-smoke'],
  'node scripts/checkers/check-sgds-crit-003-d5j-d5l-production-synthetic-smoke.mjs',
  'package command check:sgds-crit-003-d5j-d5l-production-smoke missing or changed'
);

console.log('SGDS_CRIT_003_D5J_D5L_PRODUCTION_SMOKE_CHECK=PASS');
