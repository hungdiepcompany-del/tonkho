import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

function fail(code) {
  console.error('D7_E3G_PARTIAL_STATE_READ_ONLY_DIAGNOSTIC_CHECK=FAIL');
  console.error(`FAILED_GATE=${code}`);
  process.exit(1);
}

function assertIncludes(text, needle, code) {
  if (!text.includes(needle)) fail(code);
}

function assertNotMatches(text, pattern, code) {
  if (pattern.test(text)) fail(code);
}

function countFunctionDeclarations(text, name) {
  const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  return [...withoutComments.matchAll(new RegExp(`\\bfunction\\s+${name}\\s*\\(`, 'g'))].length;
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).replace(/\s+$/g, '');
}

const files = {
  runtime: 'D7_E3G_PartialStateReadOnlyDiagnostic.js',
  entrypoints: 'Operator_Entrypoints.js',
  test: 'tests/unit/d7-e3g-partial-state-read-only-diagnostic.test.mjs',
  phase: 'docs/phases/D7_E3G_PARTIAL_STATE_READ_ONLY_DIAGNOSTIC_CHANNEL.md',
  runbook: 'docs/operations/D7_E_PARTIAL_EXECUTION_RECONCILIATION_RUNBOOK.md',
  ownerPhase: 'docs/phases/D7_E_OWNER_APPROVED_ONE_CANDIDATE_PRODUCTION_PILOT.md',
  packageJson: 'package.json'
};

for (const file of Object.values(files)) {
  if (!exists(file)) fail(`MISSING_FILE_${file.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

const runtime = read(files.runtime);
const entrypoints = read(files.entrypoints);
const unitTest = read(files.test);
const phase = read(files.phase);
const runbook = read(files.runbook);
const ownerPhase = read(files.ownerPhase);
const packageJson = JSON.parse(read(files.packageJson));

if (countFunctionDeclarations(entrypoints, 'runD7EPartialStateReadOnlyDiagnostic') !== 1) fail('PUBLIC_ENTRYPOINT_DECLARATION_COUNT_NOT_ONE');
assertIncludes(entrypoints, 'function runD7EPartialStateReadOnlyDiagnostic() {\n  const runner = createD7EPartialStateReadOnlyDiagnosticRunner_();\n  return runner.run();\n}', 'PUBLIC_ENTRYPOINT_BODY_NOT_EXACT');
if (countFunctionDeclarations(runtime, 'createD7EPartialStateReadOnlyDiagnosticRunner_') !== 1) fail('RUNNER_DECLARATION_COUNT_NOT_ONE');

for (const marker of [
  'D7_E3G_PARTIAL_STATE_READ_ONLY_DIAGNOSTIC_V1',
  'OWNER_MARKER_SCOPE: \'PREAUTHORIZED_BY_PHASE_PROMPT\'',
  'DIAGNOSTIC_MODE: \'BOUNDED_EXACT_CANDIDATE_READ_ONLY\'',
  'D7_E3G_EXECUTION_ATTEMPT_COUNT: 1',
  'D7_E_RERUN_ATTEMPT_COUNT: 0',
  'D6J_C_PUBLIC_ENTRYPOINT_EXECUTION_COUNT: 0',
  'rediscoverD7E3GCandidateReadOnly_',
  'reconstructD7E3GPlanReadOnly_',
  'inspectD7E3GFirestoreReadOnly_',
  'inspectD7E3GDriveRawReadOnly_',
  'inspectD7E3GSheetsReadOnly_',
  'inspectD7E3GGmailReadOnly_',
  'Utilities.computeDigest',
  'method: \'get\'',
  'muteHttpExceptions: true',
  'FIRESTORE_REQUEST_PATH_HASH_PREFIX',
  'SCRIPT_PROPERTY_MUTATION_COUNT: 0',
  'GMAIL_MUTATION_COUNT: 0',
  'DRIVE_MUTATION_COUNT: 0',
  'SHEETS_MUTATION_COUNT: 0',
  'FIRESTORE_MUTATION_COUNT: 0',
  'TRIGGER_MUTATION_COUNT: 0',
  'DESTRUCTIVE_OPERATION_COUNT: 0',
  'PRODUCTION_MUTATION: \'NONE\'',
  'XML_CONFLICT_FALSE_POSITIVE_ADAPTER_HASH_ALGORITHM_MISMATCH',
  'XML_CONFLICT_STORED_METADATA_HASH_MISMATCH_BLOB_CONTENT_VALID',
  'XML_CONFLICT_ACTUAL_DRIVE_BLOB_CONTENT_MISMATCH',
  'DRIVE_ARTIFACTS_VALID_SHEET_ABSENT_FIRESTORE_RECONCILIATION_REQUIRED',
  'DRIVE_ARTIFACT_CONFLICT_REQUIRES_COMPENSATING_ACTION_REVIEW',
  'UNEXPECTED_SHEET_OR_GMAIL_STATE',
  'UNEXPECTED_FIRESTORE_STATE',
  'READ_ONLY_FORENSICS_INCOMPLETE'
]) {
  assertIncludes(runtime, marker, `RUNTIME_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const forbidden of [
  /runD7EOwnerApprovedOneCandidateProductionPilot\s*\(/,
  /runD6jCOneRecordProductionMutation\s*\(/,
  /writeAndVerifyD7EDriveArtifacts_\s*\(/,
  /appendAndVerifyD7ESheetTransaction_\s*\(/,
  /saveD7EAttachmentRecords_\s*\(/,
  /acquireD7ELease_\s*\(/,
  /releaseD7ELease_\s*\(/,
  /transitionD7EJob_\s*\(/,
  /appendD7EAuditEvent_\s*\(/,
  /saveD7EReconciliationReport_\s*\(/,
  /maybeMarkD7EReconciliationRequired_\s*\(/,
  /\.setProperty\s*\(/,
  /\.deleteProperty\s*\(/,
  /ScriptApp\.newTrigger/,
  /ScriptApp\.deleteTrigger/,
  /GmailApp\.createLabel/,
  /\.addLabel\s*\(/,
  /\.removeLabel\s*\(/,
  /\.markRead\s*\(/,
  /\.markUnread\s*\(/,
  /\.createFile\s*\(/,
  /\.createFolder\s*\(/,
  /\.setTrashed\s*\(/,
  /\.appendRow\s*\(/,
  /\.setValue\s*\(/,
  /\.setValues\s*\(/,
  /\.deleteRow\s*\(/,
  /\.clear\s*\(/,
  /method:\s*['"`](post|put|patch|delete)['"`]/i,
  /runTransaction\s*\(/,
  /createDocument\s*\(/,
  /updateDocument\s*\(/,
  /deleteDocument\s*\(/
]) {
  assertNotMatches(runtime, forbidden, `FORBIDDEN_RUNTIME_PATTERN_${forbidden.toString().replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const marker of [
  'metadata and public entrypoint contract are canonical',
  'exact approved candidate with valid partial state classifies verified Drive and absent Sheet',
  'candidate mismatch fails closed',
  'multiple candidates fails closed',
  'Firestore unexpected state is classified separately',
  'Drive hash mismatch requires compensating action review',
  'metadata hash mismatch while blob content is valid is classified',
  'duplicate Drive files block as ambiguity',
  'unexpected Sheet row or Gmail label classifies unexpected state',
  'before and after snapshot mismatch blocks concurrent change',
  'read permission blocker keeps forensics incomplete',
  'sanitized logs contain no raw identifiers and counters stay zero'
]) {
  assertIncludes(unitTest, marker, `UNIT_TEST_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const text of [phase, runbook, ownerPhase]) {
  for (const marker of [
    'OWNER_MARKER_RECEIVED=YES',
    'CURRENT_PHASE_MARKER_PREAUTHORIZED=YES',
    'FUTURE_MUTATION_MARKERS_PREAUTHORIZED=NO',
    'D7_E3G_RUNTIME_MODE=READ_ONLY',
    'D7_E_RERUN_FORBIDDEN=YES',
    'PRODUCTION_MUTATION=NONE'
  ]) {
    assertIncludes(text, marker, `DOC_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }
}

for (const text of [phase, runbook, ownerPhase]) {
  for (const pattern of [
    /https:\/\/mail\.google\.com\/mail\//,
    /https:\/\/drive\.google\.com\//,
    /https:\/\/docs\.google\.com\/spreadsheets\//,
    /Bearer\s+[A-Za-z0-9._-]+/,
    /ya29\.[A-Za-z0-9._-]+/,
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
  ]) {
    assertNotMatches(text, pattern, 'RAW_PRODUCTION_IDENTIFIER_OR_SECRET_IN_D7_E3G_DOCS');
  }
}

if (packageJson.scripts['check:d7-e3g-partial-state-read-only-diagnostic'] !== 'node scripts/checkers/check-d7-e3g-partial-state-read-only-diagnostic.mjs') {
  fail('PACKAGE_COMMAND_MISSING');
}

const allowedDirty = new Set([
  files.runtime,
  files.entrypoints,
  files.test,
  files.phase,
  files.runbook,
  files.ownerPhase,
  'D7_E3I_ExactProductionConflictForensicAndSafeReconciliationPlan.js',
  'D7_E3R_ExactBoundedProductionReadOnlyAdapters.js',
  'tests/unit/d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.test.mjs',
  'tests/unit/d7-e3r-exact-bounded-production-read-only-adapters.test.mjs',
  'docs/phases/D7_E3I_EXACT_PRODUCTION_CONFLICT_FORENSIC_AND_SAFE_RECONCILIATION_PLAN.md',
  'docs/phases/D7_E3R_TO_U_EXACT_BOUNDED_PRODUCTION_READ_ONLY_ADAPTER_IMPLEMENTATION_SOURCE_SYNC_AND_FRESH_FORENSIC.md',
  'docs/evidence/D7_E3G_PARTIAL_STATE_READ_ONLY_DIAGNOSTIC_EVIDENCE.md',
  'docs/00_INDEX.md',
  'docs/07_WORK_LOG.md',
  'docs/08_DECISION_LOG.md',
  'docs/09_VALIDATION_LOG.md',
  'docs/99_NEXT_AI_HANDOFF.md',
  files.packageJson,
  'scripts/checkers/check-d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.mjs',
  'scripts/checkers/check-d7-e3r-exact-bounded-production-read-only-adapters.mjs',
  'scripts/checkers/check-d7-e3g-partial-state-read-only-diagnostic.mjs',
  'scripts/checkers/check-d7-e-owner-approved-one-candidate-production-pilot.mjs',
  'scripts/checkers/check-d7-c-d7-d-candidate-review-and-pilot-plan.mjs'
]);

const statusLines = git(['status', '--short']).split(/\r?\n/).filter(Boolean);
for (const line of statusLines) {
  const file = line.slice(3).trim().replace(/\\/g, '/');
  if (file === 'GUARD.bat' || file.startsWith('_guard/')) continue;
  if (!allowedDirty.has(file)) fail(`UNAPPROVED_DIRTY_FILE_${file.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  if ((line[0] !== ' ' || line[1] !== ' ') && (file === 'GUARD.bat' || file.startsWith('_guard/'))) fail('GUARD_FILE_STAGED');
}

const stagedFiles = git(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean);
for (const file of stagedFiles) {
  if (file === 'GUARD.bat' || file.startsWith('_guard/')) fail('GUARD_FILE_STAGED');
}

console.log('D7_E3G_PARTIAL_STATE_READ_ONLY_DIAGNOSTIC_CHECK=PASS');
