import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = Object.freeze({
  docs: 'docs/phases/D7_E4A2_EXACT_FIRESTORE_RECONCILIATION_PLAN_FINALIZATION.md',
  test: 'tests/unit/d7-e4a2-exact-firestore-reconciliation-plan-finalization.test.mjs',
  checker: 'scripts/checkers/check-d7-e4a2-exact-firestore-reconciliation-plan-finalization.mjs',
  packageJson: 'package.json',
  aggregate: 'scripts/test/run-all-checks.mjs'
});

const knownGuardDirty = Object.freeze(['GUARD.bat', '_guard/']);

function fail(code) {
  console.error(`D7_E4A2_RECONCILIATION_PLAN_CHECK=FAIL:${code}`);
  process.exit(1);
}

function read(path) {
  if (!fs.existsSync(path)) fail(`MISSING_${path.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);
  return fs.readFileSync(path, 'utf8');
}

function normalized(path) {
  return String(path || '').replace(/\\/g, '/');
}

function isGuard(path) {
  const value = normalized(path);
  return knownGuardDirty.some(item => value === item || value.startsWith(item));
}

function statusPath(line) {
  return normalized(String(line || '').slice(3));
}

function assertDirtyScope() {
  const allowed = new Set([
    ...Object.values(files),
    'scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs',
    'scripts/checkers/check-d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.mjs',
    'scripts/checkers/check-d7-e4a1a-canonical-identity-configuration-read-only-recovery.mjs',
    'scripts/checkers/check-d7-e4a1b-owner-configure-canonical-properties.mjs',
    'scripts/checkers/check-d7-e4a1c-owner-marker-single-read-only-cardinality-execution.mjs',
    'docs/00_INDEX.md',
    'docs/07_WORK_LOG.md',
    'docs/08_DECISION_LOG.md',
    'docs/09_VALIDATION_LOG.md',
    'docs/99_NEXT_AI_HANDOFF.md',
    'D7_E4B_ExactFirestoreReconciliationRuntime.js',
    'Operator_Entrypoints.js',
    'tests/unit/d7-e4b-exact-firestore-reconciliation-runtime.test.mjs',
    'scripts/checkers/check-d7-e4b-exact-firestore-reconciliation-runtime.mjs',
    'docs/phases/D7_E4B1_EXACT_RECONCILIATION_RUNTIME_IMPLEMENTATION_AND_SOURCE_SYNC.md'
  ]);
  const unexpected = execFileSync('git', ['status', '--short'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
    .map(statusPath)
    .filter(path => path && !isGuard(path) && !allowed.has(path));
  if (unexpected.length) fail(`UNEXPECTED_DIRTY_FILE_${unexpected[0].replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);
}

function assertIncludes(text, marker) {
  if (!text.includes(marker)) fail(`MISSING_${marker.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);
}

function main() {
  assertDirtyScope();
  const docs = read(files.docs);
  const test = read(files.test);
  const packageJson = read(files.packageJson);
  const aggregate = read(files.aggregate);

  for (const marker of [
    'MODE=READ_ONLY_EXACT_RECONCILIATION_PLAN_FINALIZATION_NO_PRODUCTION_MUTATION',
    'EXACT_FIRESTORE_JOB_CARDINALITY_PROVEN=YES',
    'CURRENT_JOB_STATUS=VALIDATED',
    'CURRENT_JOB_VERSION=4',
    'CURRENT_JOB_COMMIT_PLAN_PRESENT=YES',
    'CURRENT_LEASE_STATUS=RECONCILIATION_REQUIRED',
    'CURRENT_AUDIT_EVENT_COUNT=2',
    'CURRENT_RECONCILIATION_REPORT_COUNT=1',
    'CURRENT_ATTACHMENT_RECORD_COUNT=0',
    'TARGET_JOB_STATUS=RECONCILIATION_REQUIRED',
    'FIRESTORE_TOTAL_WRITE_COUNT=7',
    'FIRESTORE_WRITE_BUDGET_EXACT=YES',
    'FIRESTORE_ATTACHMENT_CREATE_COUNT=0',
    'GMAIL_WRITE_COUNT=0',
    'DRIVE_WRITE_COUNT=0',
    'SHEETS_WRITE_COUNT=0',
    'D7-E4B must preserve this state-machine contract',
    'UNKNOWN_WRITE_OUTCOME_POLICY=STOP_AND_OWNER_REVIEW',
    'RECONCILIATION_EXECUTED=NO',
    'PRODUCTION_DATA_MUTATION=NONE',
    'FINAL_STATUS=PASS_D7_E4A2_EXACT_FIRESTORE_RECONCILIATION_PLAN_READY_FOR_OWNER_APPROVAL'
  ]) assertIncludes(docs, marker);

  if (/\b[a-f0-9]{64}\b/i.test(docs)) fail('RAW_SHA256_LITERAL_IN_DOCUMENTATION');
  if (/D7_E_CANONICAL_(CANDIDATE_FINGERPRINT|XML_SHA256|PDF_SHA256)=/i.test(docs)) fail('CANONICAL_VALUE_EXPOSURE_IN_DOCUMENTATION');
  for (const forbidden of ['clasp push', 'clasp deploy', 'runD7EOwnerApprovedOneCandidateProductionPilot', 'runD7E4A1BoundedFirestoreIdentityCardinalityReadOnlyProof']) {
    if (docs.includes(forbidden)) fail(`FORBIDDEN_ACTION_${forbidden.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);
  }

  assertIncludes(test, 'exact seven-write reconciliation plan');
  assertIncludes(packageJson, 'check:d7-e4a2-exact-firestore-reconciliation-plan');
  assertIncludes(aggregate, 'check-d7-e4a2-exact-firestore-reconciliation-plan-finalization.mjs');
  console.log('D7_E4A2_RECONCILIATION_PLAN_CHECK=PASS');
}

main();
