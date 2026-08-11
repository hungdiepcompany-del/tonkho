import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const files = Object.freeze({
  docs: 'docs/phases/D7_E4A1B_OWNER_CONFIGURE_CANONICAL_PROPERTIES.md',
  test: 'tests/unit/d7-e4a1b-owner-configure-canonical-properties.test.mjs',
  checker: 'scripts/checkers/check-d7-e4a1b-owner-configure-canonical-properties.mjs',
  packageJson: 'package.json',
  aggregate: 'scripts/test/run-all-checks.mjs'
});

const knownGuardDirty = Object.freeze(['GUARD.bat', '_guard/']);

function fail(code) {
  console.error(`D7_E4A1B_CANONICAL_CONFIGURATION_CHECK=FAIL:${code}`);
  process.exit(1);
}

function read(path) {
  if (!fs.existsSync(path)) fail(`MISSING_${path.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);
  return fs.readFileSync(path, 'utf8');
}

function normalized(path) {
  return String(path || '').replace(/\\/g, '/');
}

function assertIncludes(text, expected, code) {
  if (!text.includes(expected)) fail(code);
}

function assertDirtyScope() {
  const allowed = new Set([
    ...Object.values(files),
    'scripts/checkers/check-d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.mjs',
    'scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs',
    'scripts/checkers/check-d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.mjs',
    'scripts/checkers/check-d7-e4a1a-canonical-identity-configuration-read-only-recovery.mjs',
    'scripts/checkers/check-d7-e4a1c-owner-marker-single-read-only-cardinality-execution.mjs',
    'tests/unit/d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.test.mjs',
    'tests/unit/d7-e4a1c-owner-marker-single-read-only-cardinality-execution.test.mjs',
    'docs/00_INDEX.md',
    'docs/07_WORK_LOG.md',
    'docs/08_DECISION_LOG.md',
    'docs/09_VALIDATION_LOG.md',
    'docs/99_NEXT_AI_HANDOFF.md',
    'docs/phases/D7_E4A1C_OWNER_MARKER_AND_SINGLE_READ_ONLY_CARDINALITY_EXECUTION.md',
    'tests/unit/d7-e4a2-exact-firestore-reconciliation-plan-finalization.test.mjs',
    'scripts/checkers/check-d7-e4a2-exact-firestore-reconciliation-plan-finalization.mjs',
    'docs/phases/D7_E4A2_EXACT_FIRESTORE_RECONCILIATION_PLAN_FINALIZATION.md',
    'D7_E4B_ExactFirestoreReconciliationRuntime.js',
    'Operator_Entrypoints.js',
    'tests/unit/d7-e4b-exact-firestore-reconciliation-runtime.test.mjs',
    'scripts/checkers/check-d7-e4b-exact-firestore-reconciliation-runtime.mjs',
    'docs/phases/D7_E4B1_EXACT_RECONCILIATION_RUNTIME_IMPLEMENTATION_AND_SOURCE_SYNC.md'
  ]);
  const status = execFileSync('git', ['status', '--short'], { encoding: 'utf8' });
  const unexpected = status.split(/\r?\n/).filter(Boolean).map(line => normalized(line.slice(3))).filter(path => path && !knownGuardDirty.some(item => path === item || path.startsWith(item)) && !allowed.has(path));
  if (unexpected.length) fail(`UNEXPECTED_DIRTY_FILE_${unexpected[0].replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);
}

function main() {
  assertDirtyScope();
  const docs = read(files.docs);
  const test = read(files.test);
  const packageJson = read(files.packageJson);
  const aggregate = read(files.aggregate);

  if (/\b[a-f0-9]{64}\b/i.test(docs)) fail('RAW_SHA256_LITERAL_IN_PHASE_DOCUMENTATION');
  for (const expected of [
    'PHASE=D7_E4A1B_OWNER_CONFIGURE_CANONICAL_PROPERTIES',
    'MODE=VERIFY_OWNER_CONFIGURED_CANONICAL_SCRIPT_PROPERTIES_NO_QUERY_NO_RECONCILIATION',
    'APPS_SCRIPT_PROJECT_VERIFIED=YES',
    'CANONICAL_PROPERTY_COUNT=5',
    'ALL_CANONICAL_PROPERTIES_PRESENT=YES',
    'ALL_CANONICAL_PROPERTIES_FORMAT_VALID=YES',
    'ALL_CANONICAL_PROPERTIES_MATCH_PRIVATE_ARTIFACT=YES',
    'CANDIDATE_AND_INVOICE_IDENTITY_ALIGNED=YES',
    'OWNER_MARKER_PRESENT=NO',
    'OWNER_SCRIPT_PROPERTY_MUTATION_COUNT=5',
    'CODEX_SCRIPT_PROPERTY_MUTATION_COUNT=0',
    'D7_E4A1_QUERY_EXECUTED=NO',
    'RECONCILIATION_EXECUTED=NO',
    'PRIVATE_VALUES_COMMITTED_TO_GIT=NO',
    'FINAL_STATUS=PASS_D7_E4A1B_CANONICAL_PROPERTIES_CONFIGURED_AND_VERIFIED',
    'NEXT_PHASE=D7_E4A1C_OWNER_MARKER_AND_SINGLE_READ_ONLY_CARDINALITY_EXECUTION'
  ]) assertIncludes(docs, expected, `DOCS_MISSING_${expected.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);
  assertIncludes(test, 'canonical configuration closeout retains only sanitized verification evidence', 'TEST_COVERAGE_MISSING');
  assertIncludes(packageJson, 'check:d7-e4a1b-canonical-properties', 'PACKAGE_COMMAND_MISSING');
  assertIncludes(aggregate, 'check-d7-e4a1b-owner-configure-canonical-properties.mjs', 'AGGREGATE_COMMAND_MISSING');
  console.log('D7_E4A1B_CANONICAL_CONFIGURATION_CHECK=PASS');
}

main();
