import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = Object.freeze({
  runtime: 'D7_E4A1_BoundedFirestoreIdentityCardinalityReadOnlyProof.js',
  test: 'tests/unit/d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.test.mjs',
  docs: 'docs/phases/D7_E4A1_BOUNDED_FIRESTORE_IDENTITY_CARDINALITY_READ_ONLY_PROOF.md',
  checker: 'scripts/checkers/check-d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.mjs',
  packageJson: 'package.json',
  aggregate: 'scripts/test/run-all-checks.mjs'
});

const requiredFiles = Object.freeze(Object.values(files));
const knownGuardDirty = Object.freeze(['GUARD.bat', '_guard/']);

function fail(code) {
  console.error(`D7_E4A1_CARDINALITY_CHECK=FAIL:${code}`);
  process.exit(1);
}

function source(path) {
  if (!fs.existsSync(path)) fail(`MISSING_${path.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);
  return fs.readFileSync(path, 'utf8');
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function normalized(path) {
  return String(path || '').replace(/\\/g, '/');
}

function isGuard(path) {
  const value = normalized(path);
  return knownGuardDirty.some(item => value === item || value.startsWith(item));
}

function assertIncludes(text, expected, code) {
  if (!text.includes(expected)) fail(code);
}

function assertNotMatches(text, pattern, code) {
  if (pattern.test(text)) fail(code);
}

function parseStatus(line) {
  const value = String(line || '');
  if (!value) return '';
  return normalized(value.slice(3));
}

function assertDirtyScope() {
  const allowed = new Set(requiredFiles.concat([
    'docs/00_INDEX.md',
    'docs/07_WORK_LOG.md',
    'docs/08_DECISION_LOG.md',
    'docs/09_VALIDATION_LOG.md',
    'docs/99_NEXT_AI_HANDOFF.md',
    'scripts/checkers/check-d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.mjs',
    'scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs',
    'tests/unit/d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.test.mjs',
    'tests/unit/d7-e4a1a-canonical-identity-configuration-read-only-recovery.test.mjs',
    'scripts/checkers/check-d7-e4a1a-canonical-identity-configuration-read-only-recovery.mjs',
    'docs/phases/D7_E4A1A_CANONICAL_IDENTITY_CONFIGURATION_READ_ONLY_RECOVERY.md',
    'tests/unit/d7-e4a1b-owner-configure-canonical-properties.test.mjs',
    'scripts/checkers/check-d7-e4a1b-owner-configure-canonical-properties.mjs',
    'docs/phases/D7_E4A1B_OWNER_CONFIGURE_CANONICAL_PROPERTIES.md',
    'tests/unit/d7-e4a1c-owner-marker-single-read-only-cardinality-execution.test.mjs',
    'scripts/checkers/check-d7-e4a1c-owner-marker-single-read-only-cardinality-execution.mjs',
    'docs/phases/D7_E4A1C_OWNER_MARKER_AND_SINGLE_READ_ONLY_CARDINALITY_EXECUTION.md',
    'tests/unit/d7-e4a2-exact-firestore-reconciliation-plan-finalization.test.mjs',
    'scripts/checkers/check-d7-e4a2-exact-firestore-reconciliation-plan-finalization.mjs',
    'docs/phases/D7_E4A2_EXACT_FIRESTORE_RECONCILIATION_PLAN_FINALIZATION.md',
    'D7_E4B_ExactFirestoreReconciliationRuntime.js',
    'Operator_Entrypoints.js',
    'tests/unit/d7-e4b-exact-firestore-reconciliation-runtime.test.mjs',
    'scripts/checkers/check-d7-e4b-exact-firestore-reconciliation-runtime.mjs',
    'docs/phases/D7_E4B1_EXACT_RECONCILIATION_RUNTIME_IMPLEMENTATION_AND_SOURCE_SYNC.md'
  ]));
  const unexpected = git(['status', '--short']).split(/\r?\n/).filter(Boolean).map(parseStatus).filter(path => path && !isGuard(path) && !allowed.has(path));
  if (unexpected.length) fail('UNEXPECTED_DIRTY_FILE_' + unexpected[0].replace(/[^A-Za-z0-9]+/g, '_').toUpperCase());
}

function main() {
  assertDirtyScope();
  const runtime = source(files.runtime);
  const test = source(files.test);
  const docs = source(files.docs);
  const packageJson = source(files.packageJson);
  const aggregate = source(files.aggregate);

  for (const expected of [
    'D7_E4A1_BOUNDED_FIRESTORE_IDENTITY_CARDINALITY_READ_ONLY_PROOF',
    'OWNER_APPROVED_D7_E4A1_BOUNDED_READ_ONLY_PROOF',
    'documents:runQuery',
    "collectionId: 'invoiceJobs'",
    'QUERY_LIMIT_PER_QUERY',
    'EXACT_MATCHING_JOB_COUNT',
    'DUPLICATE_MATCHING_JOB_ABSENCE_PROVEN',
    'commitPlan.driveEvidenceTargets.xmlContentHash',
    'commitPlan.driveEvidenceTargets.pdfContentHash',
    'PRODUCTION_MUTATION_COUNT: 0'
  ]) assertIncludes(runtime, expected, `RUNTIME_MISSING_${expected.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);

  for (const forbidden of [
    /\.setProperty\s*\(/,
    /\.deleteProperty\s*\(/,
    /createDocument\s*\(/,
    /updateDocument\s*\(/,
    /deleteDocument\s*\(/,
    /runTransaction\s*\(/,
    /GmailApp\./,
    /DriveApp\./,
    /SpreadsheetApp\./,
    /runD7EOwnerApprovedOneCandidateProductionPilot\s*\(/,
    /runD6jCOneRecordProductionMutation\s*\(/,
    /clasp\s+(push|deploy|run)/i,
    /firebase\s+deploy/i
  ]) assertNotMatches(runtime, forbidden, `FORBIDDEN_RUNTIME_${forbidden.toString().replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);

  for (const expected of [
    'D7-E4A1 declares the bounded production read-only cardinality contract',
    'two exact composite results fail closed as duplicate matching jobs',
    'zero deterministic job candidates is a bounded exact-zero proof',
    'a Firestore index precondition is sanitized',
    'partial-identity candidate is classified separately',
    'duplicate query references are deduplicated',
    'exceeds the limit is blocked',
    'assertZeroMutation'
  ]) assertIncludes(test, expected, `TEST_MISSING_${expected.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);

  for (const expected of [
    'MODE=BOUNDED_PRODUCTION_READ_ONLY_CARDINALITY_PROOF_NO_MUTATION',
    'EXACT_MATCHING_JOB_COUNT=0|1|2_PLUS',
    'SOURCE_SYNC_REQUIRED=YES',
    'RECONCILIATION_EXECUTED=NO',
    'PRODUCTION_MUTATION=NONE',
    'D7_E4A2_FINALIZATION_AFTER_EXACT_CARDINALITY_PROOF'
  ]) assertIncludes(docs, expected, `DOCS_MISSING_${expected.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);

  assertIncludes(packageJson, 'check:d7-e4a1-bounded-firestore-cardinality-read-only', 'PACKAGE_COMMAND_MISSING');
  assertIncludes(aggregate, 'check-d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.mjs', 'AGGREGATE_COMMAND_MISSING');
  console.log('D7_E4A1_CARDINALITY_CHECK=PASS');
}

main();
