import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const runnerPath = 'd6jCOneRecordProductionMutation.js';
const testPath = 'tests/unit/d6j-c-one-record-production-mutation.test.mjs';
const phaseDocPath = 'docs/phases/D6J_C1_FIRESTORE_LEASE_LIFECYCLE_AND_PRODUCTION_RERUN_FIX.md';
const evidenceDocPath = 'docs/evidence/D6J_C1_FIRESTORE_LEASE_LIFECYCLE_AND_PRODUCTION_RERUN_FIX_EVIDENCE.md';

for (const file of [runnerPath, testPath, phaseDocPath, evidenceDocPath]) {
  assert.equal(exists(file), true, `missing D6J-C1 file: ${file}`);
}

const runner = read(runnerPath);
const tests = read(testPath);
const phaseDoc = read(phaseDocPath);
const evidenceDoc = read(evidenceDocPath);
const packageJson = JSON.parse(read('package.json'));

for (const marker of [
  'const D6J_C_LEASE_DURATION_MS_ = 10 * 60 * 1000',
  'createD6jCFirestoreLeaseStore_',
  'createD6jCDefaultLeaseStore_',
  'acquireLease',
  'releaseLease',
  'markLeaseReconciliationRequired',
  'getLease',
  "status: 'ACTIVE'",
  "status: 'RELEASED'",
  "status: 'RECONCILIATION_REQUIRED'",
  'fencingToken',
  'acquiredAt',
  'expiresAt',
  'releasedAt',
  'finalJobStatus',
  'updatedAt',
  'assertD6jCFutureTimestamp_',
  'isD6jCTimestampExpired_',
  'previousFencingTokenHashPrefix',
  'closeD6jCLease_',
  'LEASE_FINAL_STATUS',
  'LEASE_RELEASE_STATUS',
  'LEASE_EXPIRES_AT',
  'LEASE_RECLAIM_STATUS',
  'PASS_ONE_RECORD_PRODUCTION_MUTATION_COMPLETED',
  'PASS_ONE_RECORD_PRODUCTION_MUTATION_CHANNEL_READY',
  'PASS_IDEMPOTENT_COMPLETED_NOOP',
  'BLOCKED_D6J_C_LEASE_FENCING_TOKEN_MISMATCH',
  'ACTIVE_LEASE_FOUND'
]) {
  assert.equal(runner.includes(marker), true, `runner missing D6J-C1 marker: ${marker}`);
}

for (const marker of [
  'production default lease store exposes full lifecycle methods',
  'lease store reclaims expired active lease with fenced replacement',
  'lease store blocks non-expired active lease owned by another job',
  'lease store blocks same-job fencing mismatch',
  'released lease supports controlled retry',
  'LEASE_RELEASE_STATUS',
  'ACQUIRED_AFTER_RECONCILIATION_REQUIRED',
  'FAILED_BEFORE_EXTERNAL_MUTATION',
  'deleteDocument'
]) {
  assert.equal(tests.includes(marker), true, `tests missing D6J-C1 marker: ${marker}`);
}

for (const forbidden of [
  'deleteDocument(',
  'ScriptApp.newTrigger',
  'ScriptApp.deleteTrigger',
  'mainRun(',
  'scanInvoiceOutEmails_(',
  'scanInvoiceInEmails_(',
  'triggerScanInvoiceDriveFolder(',
  '.setTrashed(',
  '.deleteRow(',
  '.clear(',
  '--force',
  'OWNER_APPROVED_D6J_C_ONE_RECORD_PRODUCTION_MUTATION='
]) {
  assert.equal(runner.includes(forbidden), false, `forbidden D6J-C1 runner token: ${forbidden}`);
}

for (const docMarker of [
  'PHASE=D6J_C1_FIRESTORE_LEASE_LIFECYCLE_AND_PRODUCTION_RERUN_FIX',
  'LEASE_LIFECYCLE_IMPLEMENTATION=PASS',
  'PRODUCTION_EQUIVALENT_RERUN_TEST=PASS',
  'LEASE_DELETE_USED=NO',
  'SUCCESS_STATUS=PASS_ONE_RECORD_PRODUCTION_MUTATION_COMPLETED',
  'OWNER_APPROVAL_MARKER_CONFIGURED=NO',
  'PRODUCTION_MUTATION_EXECUTED=NO',
  'PRODUCTION_MUTATION=NONE',
  'NEXT_ACTION=OWNER_REVIEW_AND_EXPLICIT_EXECUTION_APPROVAL'
]) {
  assert.equal((phaseDoc + '\n' + evidenceDoc).includes(docMarker), true, `docs missing D6J-C1 marker: ${docMarker}`);
}

assert.equal(
  packageJson.scripts['check:d6j-c1-firestore-lease-lifecycle-production-rerun-fix'],
  'node scripts/checkers/check-d6j-c1-firestore-lease-lifecycle-production-rerun-fix.mjs',
  'package command check:d6j-c1-firestore-lease-lifecycle-production-rerun-fix missing or changed'
);

console.log('D6J_C1_FIRESTORE_LEASE_LIFECYCLE_PRODUCTION_RERUN_FIX_CHECK=PASS');
