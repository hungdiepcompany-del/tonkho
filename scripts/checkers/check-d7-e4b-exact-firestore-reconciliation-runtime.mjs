import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = Object.freeze({
  runtime: 'D7_E4B_ExactFirestoreReconciliationRuntime.js',
  entrypoints: 'Operator_Entrypoints.js',
  test: 'tests/unit/d7-e4b-exact-firestore-reconciliation-runtime.test.mjs',
  checker: 'scripts/checkers/check-d7-e4b-exact-firestore-reconciliation-runtime.mjs',
  docs: 'docs/phases/D7_E4B1_EXACT_RECONCILIATION_RUNTIME_IMPLEMENTATION_AND_SOURCE_SYNC.md',
  packageJson: 'package.json',
  aggregate: 'scripts/test/run-all-checks.mjs'
});

const knownGuardDirty = Object.freeze(['GUARD.bat', '_guard/']);
const allowedDirty = new Set([
  ...Object.values(files),
  'scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs',
  'scripts/checkers/check-d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.mjs',
  'scripts/checkers/check-d7-e4a1a-canonical-identity-configuration-read-only-recovery.mjs',
  'scripts/checkers/check-d7-e4a1b-owner-configure-canonical-properties.mjs',
  'scripts/checkers/check-d7-e4a1c-owner-marker-single-read-only-cardinality-execution.mjs',
  'scripts/checkers/check-d7-e4a2-exact-firestore-reconciliation-plan-finalization.mjs'
]);

function fail(code) {
  console.error(`D7_E4B_EXACT_RECONCILIATION_RUNTIME_CHECK=FAIL:${code}`);
  process.exit(1);
}

function read(path) {
  if (!fs.existsSync(path)) fail(`MISSING_${path.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);
  return fs.readFileSync(path, 'utf8');
}

function normalized(path) {
  return String(path || '').replace(/\\/g, '/');
}

function statusPath(line) {
  return normalized(String(line || '').slice(3));
}

function isGuard(path) {
  return knownGuardDirty.some(item => path === item || path.startsWith(item));
}

function assertDirtyScope() {
  const unexpected = execFileSync('git', ['status', '--short'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
    .map(statusPath)
    .filter(path => path && !isGuard(path) && !allowedDirty.has(path));
  if (unexpected.length) fail(`UNEXPECTED_DIRTY_FILE_${unexpected[0].replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);
}

function mustInclude(text, marker) {
  if (!text.includes(marker)) fail(`MISSING_${marker.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);
}

function main() {
  assertDirtyScope();
  const runtime = read(files.runtime);
  const entrypoints = read(files.entrypoints);
  const tests = read(files.test);
  const docs = read(files.docs);
  const packageJson = JSON.parse(read(files.packageJson));
  const aggregate = read(files.aggregate);

  for (const marker of [
    "D7_E4B_OWNER_MARKER_PROPERTY_ = 'D7_E4B_OWNER_APPROVAL_MARKER'",
    'SEVEN_FIRESTORE_WRITES_NO_EXTERNAL_MUTATION',
    "D7_E4B_PUBLIC_ENTRYPOINT_ = 'runD7E4BExactFirestoreReconciliation'",
    'JOB_UPDATES: 3',
    'LEASE_UPDATES: 2',
    'RECONCILIATION_REPORT_CREATES: 1',
    'AUDIT_EVENT_CREATES: 1',
    'ATTACHMENT_CREATES: 0',
    'FIRESTORE_TOTAL: 7',
    "fromStatus: 'VALIDATED'",
    "toStatus: 'FAILED_REVIEW_REQUIRED'",
    "fromStatus: 'FAILED_REVIEW_REQUIRED'",
    "toStatus: 'RECONCILIATION_REQUIRED'",
    'expectedVersion: 5',
    'expectedVersion: 6',
    'expectedGeneration',
    'fencingToken',
    'd7e4b_owner_adoption_',
    "auditEventId: 'evt_000003'",
    'SHEET_ATTRIBUTION',
    'ATTRIBUTION_UNPROVEN',
    'sheetCreator: \'UNKNOWN\'',
    'UNKNOWN_WRITE_OUTCOME_REQUIRES_OWNER_REVIEW',
    'PASS_D7_E4B_ALREADY_RECONCILED_NOOP',
    'POST_WRITE_READ_ONLY_VERIFICATION',
    'RAW_SENSITIVE_VALUE_LOGGED_COUNT: 0'
  ]) mustInclude(runtime, marker);

  assert.match(entrypoints, /function runD7E4BExactFirestoreReconciliation\(\) \{[\s\S]*?createD7E4BExactFirestoreReconciliationRunner_\(\)[\s\S]*?runner\.run\(\)/);
  assert.doesNotMatch(runtime, /runD7EOwnerApprovedOneCandidateProductionPilot\s*\(/);
  assert.doesNotMatch(runtime, /rediscoverD7ECandidateReadOnly_|runD6jCOneRecordProductionMutation\s*\(/);
  assert.doesNotMatch(runtime, /GmailApp\.|createFile\s*\(|setValues\s*\(|setProperty\s*\(|deleteProperty\s*\(|newTrigger\s*\(|deleteFile\s*\(/);
  assert.doesNotMatch(runtime, /fromStatus:\s*'VALIDATED',[\s\S]{0,100}toStatus:\s*'RECONCILIATION_REQUIRED'/);
  assert.equal((runtime.match(/saveReconciliationReport\s*\(/g) || []).length, 1);
  assert.equal((runtime.match(/appendAuditEvent\s*\(/g) || []).length, 1);
  assert.equal((runtime.match(/reacquireReconciliationLease\s*\(/g) || []).length >= 2, true);
  assert.equal((runtime.match(/finalizeReconciliationLease\s*\(/g) || []).length >= 3, true);

  for (let index = 1; index <= 39; index += 1) mustInclude(tests, `${index} `);
  for (const marker of [
    'EXACT_SUCCESS_WRITE_BUDGET=7',
    'FAILURE_PATH_MAX_FIRESTORE_WRITE_COUNT=7',
    'INITIAL_EXPECTED_JOB_VERSION=4',
    'FINAL_EXPECTED_JOB_VERSION=7',
    'OWNER_MARKER_CONFIGURED=NO',
    'PRODUCTION_EXECUTION_COUNT=0',
    'FIRESTORE_PRODUCTION_WRITE_COUNT=0',
    'RECONCILIATION_EXECUTED=NO',
    'PRODUCTION_DATA_MUTATION=NONE'
  ]) mustInclude(docs, marker);
  if (/\b[a-f0-9]{64}\b/i.test(docs)) fail('RAW_SHA256_LITERAL_IN_DOCUMENTATION');

  assert.equal(
    packageJson.scripts['check:d7-e4b-exact-firestore-reconciliation-runtime'],
    'node scripts/checkers/check-d7-e4b-exact-firestore-reconciliation-runtime.mjs'
  );
  mustInclude(aggregate, 'check-d7-e4b-exact-firestore-reconciliation-runtime.mjs');

  execFileSync('node', ['--test', files.test], { stdio: 'inherit' });
  console.log('D7_E4B_EXACT_RECONCILIATION_RUNTIME_CHECK=PASS');
}

main();
