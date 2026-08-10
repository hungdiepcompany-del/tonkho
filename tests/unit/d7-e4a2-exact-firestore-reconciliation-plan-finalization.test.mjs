import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'docs/phases/D7_E4A2_EXACT_FIRESTORE_RECONCILIATION_PLAN_FINALIZATION.md',
    'scripts/checkers/check-d7-e4a2-exact-firestore-reconciliation-plan-finalization.mjs'
  ],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const documentPath = 'docs/phases/D7_E4A2_EXACT_FIRESTORE_RECONCILIATION_PLAN_FINALIZATION.md';
const document = fs.readFileSync(documentPath, 'utf8');
const packageJson = fs.readFileSync('package.json', 'utf8');
const aggregate = fs.readFileSync('scripts/test/run-all-checks.mjs', 'utf8');

test('D7-E4A2 records one-job current state and an exact seven-write reconciliation plan', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  for (const marker of [
    'PHASE=D7_E4A2_EXACT_FIRESTORE_RECONCILIATION_PLAN_FINALIZATION',
    'EXACT_FIRESTORE_JOB_CARDINALITY_PROVEN=YES',
    'CURRENT_JOB_STATUS=VALIDATED',
    'CURRENT_JOB_VERSION=4',
    'CURRENT_JOB_RECONCILIATION_STATUS=RECONCILIATION_REQUIRED',
    'CURRENT_LEASE_STATUS=RECONCILIATION_REQUIRED',
    'CURRENT_ATTACHMENT_RECORD_COUNT=0',
    'FIRESTORE_TOTAL_WRITE_COUNT=7',
    'FIRESTORE_WRITE_BUDGET_EXACT=YES',
    'TARGET_JOB_STATUS=RECONCILIATION_REQUIRED',
    'PRODUCTION_DATA_MUTATION=NONE',
    'FINAL_STATUS=PASS_D7_E4A2_EXACT_FIRESTORE_RECONCILIATION_PLAN_READY_FOR_OWNER_APPROVAL'
  ]) assert.equal(document.includes(marker), true, marker);
});

test('D7-E4A2 retains the legal durable state transition and external no-write boundary', () => {
  assert.equal(document.includes('`VALIDATED -> FAILED_REVIEW_REQUIRED -> RECONCILIATION_REQUIRED`'), true);
  assert.equal(document.includes('GMAIL_WRITE_COUNT=0'), true);
  assert.equal(document.includes('DRIVE_WRITE_COUNT=0'), true);
  assert.equal(document.includes('SHEETS_WRITE_COUNT=0'), true);
  assert.equal(document.includes('FIRESTORE_ATTACHMENT_CREATE_COUNT=0'), true);
  assert.equal(document.includes('ROLLBACK_POLICY=NO_DELETE_NO_EXTERNAL_COMPENSATION'), true);
});

test('D7-E4A2 documentation contains no full SHA-256 values or production identifiers', () => {
  assert.equal(/\b[a-f0-9]{64}\b/i.test(document), false);
  assert.equal(document.includes('D7_E_CANONICAL_CANDIDATE_FINGERPRINT='), false);
  assert.equal(document.includes('D7_E_CANONICAL_XML_SHA256='), false);
  assert.equal(document.includes('D7_E_CANONICAL_PDF_SHA256='), false);
});

test('D7-E4A2 checker is independently runnable and aggregated', () => {
  assert.equal(packageJson.includes('check:d7-e4a2-exact-firestore-reconciliation-plan'), true);
  assert.equal(aggregate.includes('check-d7-e4a2-exact-firestore-reconciliation-plan-finalization.mjs'), true);
});
