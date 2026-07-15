import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const docPath = 'docs/phases/SGDS_CRIT_003_D5I_PRODUCTION_FIRESTORE_SHADOW_ROLLOUT_READINESS.md';
const runbookPath = 'docs/runbooks/SGDS_CRIT_003_D5F_ONE_JOB_FIRESTORE_SHADOW_SMOKE.md';
const handoffPath = 'docs/99_NEXT_AI_HANDOFF.md';
const pkg = JSON.parse(read('package.json'));

const doc = read(docPath);
const runbook = read(runbookPath);
const handoff = read(handoffPath);

const requiredDocMarkers = [
  'D5I_READINESS_STATUS=PASS',
  'ONE_JOB_ONLY=YES',
  'ONE_KNOWN_INVOICE_ONLY=YES',
  'SHADOW_FIRESTORE_WRITE_ONLY=YES',
  'GMAIL_WRITE=NONE',
  'DRIVE_WRITE=NONE',
  'SHEETS_WRITE=NONE',
  'FIRESTORE_REPAIR=NONE',
  'PRODUCTION_WRITE_EXECUTED=NO',
  'ROLLBACK_POLICY_RECOMMENDATION=KEEP_AS_AUDIT_EVIDENCE',
  'PRODUCTION_CREDENTIAL_CHECKLIST=DEFINED',
  'D5D_R_PRODUCTION_SMOKE=POSTPONED_BY_OWNER',
  'SGDS_CRIT_003_STATUS=NOT_FIXED',
  'NEXT_ALLOWED_PHASE=SGDS_CRIT_003_D5J_ONE_JOB_PRODUCTION_FIRESTORE_SHADOW_WRITE'
];
for (const marker of requiredDocMarkers) {
  assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5I doc missing marker: ${marker}`);
}

const requiredRunbookMarkers = [
  'ONE_JOB_ONLY',
  'ONE_KNOWN_INVOICE_ONLY',
  'SHADOW_FIRESTORE_WRITE_ONLY',
  'GMAIL_WRITE=NONE',
  'DRIVE_WRITE=NONE',
  'SHEETS_WRITE=NONE',
  'FIRESTORE_REPAIR=NONE',
  'preflight project/account',
  'derive deterministic jobId',
  'write one SHADOW job',
  'verify no duplicate job',
  'capture sanitized evidence',
  'KEEP_AS_AUDIT_EVIDENCE',
  'DELETE_EXACT_TEST_JOB_AND_SUBCOLLECTIONS',
  'no broad query delete'
];
for (const marker of requiredRunbookMarkers) {
  assert.match(runbook, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5I runbook missing marker: ${marker}`);
}

assert.match(handoff, /NEXT_ALLOWED_SUBPHASE=SGDS_CRIT_003_D5J_ONE_JOB_PRODUCTION_FIRESTORE_SHADOW_WRITE/, 'handoff missing D5J next phase');
assert.equal(pkg.scripts['check:sgds-crit-003-d5i'], 'node scripts/checkers/check-sgds-crit-003-d5i-rollout-readiness.mjs');

console.log('SGDS_CRIT_003_D5I_CHECK=PASS');
