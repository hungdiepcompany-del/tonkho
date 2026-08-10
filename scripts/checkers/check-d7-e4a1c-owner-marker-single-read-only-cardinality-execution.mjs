import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const files = Object.freeze({
  docs: 'docs/phases/D7_E4A1C_OWNER_MARKER_AND_SINGLE_READ_ONLY_CARDINALITY_EXECUTION.md',
  test: 'tests/unit/d7-e4a1c-owner-marker-single-read-only-cardinality-execution.test.mjs',
  checker: 'scripts/checkers/check-d7-e4a1c-owner-marker-single-read-only-cardinality-execution.mjs',
  packageJson: 'package.json',
  aggregate: 'scripts/test/run-all-checks.mjs'
});

const knownGuardDirty = Object.freeze(['GUARD.bat', '_guard/']);

function fail(code) {
  console.error(`D7_E4A1C_CARDINALITY_CLOSEOUT_CHECK=FAIL:${code}`);
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
    'scripts/checkers/check-d7-e4a1b-owner-configure-canonical-properties.mjs',
    'tests/unit/d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.test.mjs',
    'docs/00_INDEX.md',
    'docs/07_WORK_LOG.md',
    'docs/08_DECISION_LOG.md',
    'docs/09_VALIDATION_LOG.md',
    'docs/99_NEXT_AI_HANDOFF.md'
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
    'PHASE=D7_E4A1C_OWNER_MARKER_AND_SINGLE_READ_ONLY_CARDINALITY_EXECUTION',
    'MODE=POST_EXECUTION_CLOSEOUT_NO_RERUN_NO_RECONCILIATION',
    'PRIVATE_EXECUTION_EVIDENCE_FOUND=YES',
    'EVIDENCE_PHASE_VALID=YES',
    'EVIDENCE_SCHEMA_VALID=YES',
    'EVIDENCE_ENTRYPOINT_VALID=YES',
    'OWNER_APPROVAL_MARKER_VALID_AT_EXECUTION=YES',
    'OWNER_MARKER_PRESENT_AFTER_EXECUTION=NO',
    'QUERY_EXECUTED=YES',
    'QUERY_COUNT=2',
    'QUERY_LIMIT_PER_QUERY=2',
    'EXACT_MATCHING_JOB_COUNT=1',
    'EXACT_FIRESTORE_JOB_CARDINALITY_PROVEN=YES',
    'DUPLICATE_MATCHING_JOB_ABSENCE_PROVEN=YES',
    'D7_E4A1_RERUN=NO',
    'PRODUCTION_DATA_MUTATION=NONE',
    'SHEET_ROW_ATTRIBUTION=ATTRIBUTION_UNPROVEN',
    'FINAL_STATUS=PASS_D7_E4A1C_EXACT_ONE_FIRESTORE_JOB_CARDINALITY_PROVEN',
    'NEXT_PHASE=D7_E4A2_EXACT_FIRESTORE_RECONCILIATION_PLAN_FINALIZATION'
  ]) assertIncludes(docs, expected, `DOCS_MISSING_${expected.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);
  assertIncludes(test, 'single cardinality closeout retains only sanitized evidence and no rerun authorization', 'TEST_COVERAGE_MISSING');
  assertIncludes(packageJson, 'check:d7-e4a1c-cardinality-closeout', 'PACKAGE_COMMAND_MISSING');
  assertIncludes(aggregate, 'check-d7-e4a1c-owner-marker-single-read-only-cardinality-execution.mjs', 'AGGREGATE_COMMAND_MISSING');
  console.log('D7_E4A1C_CARDINALITY_CLOSEOUT_CHECK=PASS');
}

main();
