import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

function fail(code) {
  console.error('D7_E_OWNER_APPROVED_ONE_CANDIDATE_PRODUCTION_PILOT_CHECK=FAIL');
  console.error(`FAILED_GATE=${code}`);
  process.exit(1);
}

function assertIncludes(text, needle, code) {
  if (!text.includes(needle)) fail(code);
}

function assertMatches(text, pattern, code) {
  if (!pattern.test(text)) fail(code);
}

function assertNotMatches(text, pattern, code) {
  if (pattern.test(text)) fail(code);
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).replace(/\s+$/g, '');
}

const files = {
  runtime: 'D7_E_OwnerApprovedOneCandidateProductionPilot.js',
  entrypoints: 'Operator_Entrypoints.js',
  d6j: 'd6jCOneRecordProductionMutation.js',
  d6kPolicy: 'docs/architecture/D6K_FINAL_OPERATOR_ENTRYPOINT_POLICY.md',
  d7dPlan: 'docs/phases/D7_D_BOUNDED_PRODUCTION_PILOT_EXECUTION_PLAN.md',
  phase: 'docs/phases/D7_E_OWNER_APPROVED_ONE_CANDIDATE_PRODUCTION_PILOT.md',
  contract: 'docs/architecture/D7_E_SAFE_EXECUTION_CHANNEL_CONTRACT.md',
  runbook: 'docs/operations/D7_E_SOURCE_SYNC_AND_OWNER_EXECUTION_RUNBOOK.md',
  evidence: 'docs/evidence/D7_E1_EXECUTION_CHANNEL_IMPLEMENTATION_EVIDENCE.md',
  test: 'tests/unit/d7-e-owner-approved-one-candidate-production-pilot.test.mjs',
  packageJson: 'package.json',
};

for (const file of Object.values(files)) {
  if (!exists(file)) fail(`MISSING_FILE_${file.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

const runtime = read(files.runtime);
const entrypoints = read(files.entrypoints);
const d6j = read(files.d6j);
const d6kPolicy = read(files.d6kPolicy);
const d7dPlan = read(files.d7dPlan);
const phase = read(files.phase);
const contract = read(files.contract);
const runbook = read(files.runbook);
const evidence = read(files.evidence);
const unitTest = read(files.test);
const packageJson = JSON.parse(read(files.packageJson));

const publicEntryMatches = [...entrypoints.matchAll(/function\s+runD7EOwnerApprovedOneCandidateProductionPilot\s*\(\)\s*\{/g)];
if (publicEntryMatches.length !== 1) fail('D7_E_PUBLIC_ENTRYPOINT_COUNT_NOT_ONE');
const publicBody = entrypoints.match(/function runD7EOwnerApprovedOneCandidateProductionPilot\(\) \{([\s\S]*?)\n\}/);
if (!publicBody) fail('D7_E_PUBLIC_ENTRYPOINT_BODY_NOT_FOUND');
assertMatches(publicBody[1], /const runner = createD7EOwnerApprovedOneCandidateProductionPilotRunner_\(\);/, 'D7_E_ENTRYPOINT_DOES_NOT_CREATE_RUNNER');
assertMatches(publicBody[1], /return runner\.run\(\);/, 'D7_E_ENTRYPOINT_DOES_NOT_DELEGATE_TO_RUN');
assertNotMatches(publicBody[1], /runD6jCOneRecordProductionMutation|PropertiesService|ScriptApp|GmailApp|DriveApp|SpreadsheetApp/, 'D7_E_ENTRYPOINT_BODY_TOO_BROAD');

assertMatches(runtime, /function createD7EOwnerApprovedOneCandidateProductionPilotRunner_\s*\(/, 'D7_E_RUNNER_FACTORY_MISSING');
assertIncludes(runtime, "const D7_E_APPROVAL_PROPERTY_ = 'D7_E_OWNER_APPROVAL_MARKER';", 'D7_E_APPROVAL_PROPERTY_MISSING');
assertIncludes(runtime, "const D7_E_APPROVAL_MARKER_ = 'OWNER_APPROVE_D7E_ONE_CANDIDATE_PRODUCTION_PILOT';", 'D7_E_APPROVAL_MARKER_MISSING');
assertIncludes(runtime, "const D7_E_EXPECTED_CANDIDATE_FINGERPRINT_PROPERTY_ = 'D7_E_EXPECTED_CANDIDATE_FINGERPRINT';", 'D7_E_FINGERPRINT_PROPERTY_MISSING');
assertIncludes(runtime, "const D7_E_EXPECTED_INVOICE_KEY_HASH_PROPERTY_ = 'D7_E_EXPECTED_INVOICE_KEY_HASH';", 'D7_E_INVOICE_HASH_PROPERTY_MISSING');
assertIncludes(runtime, "const D7_E_EXPECTED_ATTACHMENT_SET_SHA256_PROPERTY_ = 'D7_E_EXPECTED_ATTACHMENT_SET_SHA256';", 'D7_E_ATTACHMENT_SET_PROPERTY_MISSING');
assertIncludes(runtime, 'BLOCKED_OLD_D6J_MARKER_CANNOT_AUTHORIZE_D7_E', 'OLD_D6J_MARKER_BLOCK_MISSING');
assertNotMatches(runtime, /runD6jCOneRecordProductionMutation\s*\(/, 'D7E_CALLS_D6J_C_PUBLIC_ENTRYPOINT');

assertMatches(d6j, /function runD6jCOneRecordProductionMutation\(\) \{\s*return blockD6kHistoricalPhaseEntrypoint_\(D6J_C_MUTATION_ENTRYPOINT_\);\s*\}/, 'D6J_C_PUBLIC_ENTRYPOINT_NOT_FROZEN');
assertIncludes(d6kPolicy, 'HISTORICAL_PHASE_CLOSED_DO_NOT_EXECUTE', 'D6K_POLICY_DOC_FROZEN_STATUS_MISSING');

for (const [name, value] of [
  ['D7_E_MAX_GMAIL_CANDIDATES_', 1],
  ['D7_E_MAX_INVOICES_', 1],
  ['D7_E_MAX_PDF_ATTACHMENTS_', 1],
  ['D7_E_MAX_XML_ATTACHMENTS_', 1],
  ['D7_E_MAX_DRIVE_FOLDER_CREATIONS_', 0],
  ['D7_E_MAX_DRIVE_FILES_CREATED_', 2],
  ['D7_E_MAX_SHEET_ROWS_INSERTED_', 1],
  ['D7_E_MAX_SHEET_ROWS_UPDATED_', 0],
  ['D7_E_MAX_FIRESTORE_JOBS_CREATED_', 1],
  ['D7_E_MAX_FIRESTORE_ATTACHMENT_RECORDS_CREATED_', 2],
  ['D7_E_MAX_FIRESTORE_JOB_TRANSITIONS_', 5],
  ['D7_E_MAX_FIRESTORE_AUDIT_EVENTS_', 3],
  ['D7_E_MAX_FIRESTORE_RECONCILIATION_REPORTS_', 1],
  ['D7_E_MAX_FIRESTORE_TOTAL_WRITE_OPERATIONS_', 16],
  ['D7_E_MAX_GMAIL_LABEL_MUTATIONS_', 0],
  ['D7_E_MAX_SCRIPT_PROPERTY_MUTATIONS_', 0],
  ['D7_E_MAX_TRIGGER_MUTATIONS_', 0],
  ['D7_E_MAX_DESTRUCTIVE_OPERATIONS_', 0],
]) {
  assertMatches(runtime, new RegExp(`const\\s+${name}\\s*=\\s*${value}\\s*;`), `D7_E_BUDGET_MISSING_${name}`);
  assertIncludes(d7dPlan, `${name.replace(/^D7_E_|_$/g, '')}=${value}`.replace('MAX_', 'MAX_'), `D7_D_BUDGET_DOC_MISSING_${name}`);
}

for (const marker of [
  'candidateFingerprint === expectedFingerprint',
  'invoiceKeyHash === expectedInvoice',
  'attachmentSetHash === expectedAttachmentSet',
  'runD7EFreshPrecheck_',
  'assertD7ESamePrecheck_',
  'assertD7ENoDuplicateBeforeFirstMutation_',
  'validateSheetSchema',
  'tryLock(30000)',
  'acquireD7ELease_',
  'releaseD7ELease_',
  'PASS_ALREADY_COMPLETED_IDEMPOTENT_NOOP',
  'RECONCILIATION_REQUIRED',
  'sanitizeD7EString_',
  'MAX_FIRESTORE_TOTAL_WRITE_OPERATIONS',
]) {
  assertIncludes(runtime, marker, `RUNTIME_CONTRACT_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const forbidden of [
  'ScriptApp.newTrigger',
  'ScriptApp.deleteTrigger',
  '.setProperty(',
  '.deleteProperty(',
  '.createFolder(',
  '.appendRow(',
  '.setValue(',
  '.setValues(',
  '.deleteRow(',
  '.clear(',
  '.setTrashed(',
  'clasp push',
  'firebase deploy',
]) {
  if (runtime.includes(forbidden)) fail(`FORBIDDEN_RUNTIME_PATTERN_${forbidden.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const marker of [
  'PHASE=D7_E_OWNER_APPROVED_ONE_CANDIDATE_PRODUCTION_PILOT',
  'LOCAL_SOURCE_IMPLEMENTATION=PASS',
  'D7_E_ENTRYPOINT_EXECUTED=NO',
  'PRODUCTION_MUTATION=NONE',
  'CLASP_PUSH_RUN=false',
  'REMOTE_SOURCE_SYNC=NOT_RUN',
  'OWNER_APPROVE_D7E_SYNCED_CHANNEL_ONE_CANDIDATE_PRODUCTION_EXECUTION',
]) {
  for (const [label, text] of [['phase', phase], ['contract', contract], ['runbook', runbook], ['evidence', evidence]]) {
    assertIncludes(text, marker, `DOC_${label.toUpperCase()}_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }
}

for (const marker of [
  'candidate rediscovery | REUSE_CURRENT_MODULE',
  'Drive write | REUSE_AUDITED_PRIVATE_HELPER',
  'Sheet append | REUSE_AUDITED_PRIVATE_HELPER',
  'approval marker | IMPLEMENT_D7_E_SPECIFIC',
  'mutation counting | IMPLEMENT_D7_E_SPECIFIC',
  'idempotent rerun | IMPLEMENT_D7_E_SPECIFIC',
  'BLOCKED_CONTRACT_UNKNOWN=0',
]) {
  assertIncludes(contract, marker, `CONTRACT_MATRIX_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const marker of [
  'GATE_1=LOCAL_IMPLEMENTATION_PASS',
  'GATE_2=APPS_SCRIPT_REMOTE_SOURCE_SYNC_AND_HASH_VERIFICATION',
  'GATE_3=FRESH_OWNER_EXECUTION_MARKER_AFTER_SYNC',
  'ACCEPTED_FOR_IMPLEMENTATION_AND_CHANNEL_PREPARATION',
  'NOT_VALID_FOR_POST_IMPLEMENTATION_EXECUTION',
  'SUPERSEDED_FOR_EXECUTION_BY_FRESH_POST_SYNC_MARKER',
]) {
  assertIncludes(runbook, marker, `RUNBOOK_GATE_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const marker of [
  'missing approval marker',
  'old D6J marker cannot substitute',
  'candidate count zero',
  'mutation budget exceeded',
  'completed rerun is an idempotent no-op',
  'D7_E_SYNTHETIC_PDF_FAILURE',
  'BLOCKED_DIFFERENT_IDENTITY_EXISTING_JOB',
]) {
  assertIncludes(unitTest, marker, `UNIT_TEST_CONTRACT_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const text of [phase, contract, runbook, evidence]) {
  for (const pattern of [
    /https:\/\/mail\.google\.com\/mail\//,
    /https:\/\/drive\.google\.com\//,
    /https:\/\/docs\.google\.com\/spreadsheets\//,
    /Bearer\s+[A-Za-z0-9._-]+/,
    /ya29\.[A-Za-z0-9._-]+/,
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  ]) {
    assertNotMatches(text, pattern, 'RAW_PRODUCTION_IDENTIFIER_OR_SECRET_IN_D7_E_DOCS');
  }
}

if (
  packageJson.scripts['check:d7-e-owner-approved-one-candidate-production-pilot'] !==
  'node scripts/checkers/check-d7-e-owner-approved-one-candidate-production-pilot.mjs'
) {
  fail('PACKAGE_COMMAND_MISSING');
}

const allowedDirty = new Set([
  files.runtime,
  files.entrypoints,
  files.d7dPlan,
  files.phase,
  files.contract,
  files.runbook,
  'docs/operations/D7_E_PARTIAL_EXECUTION_RECONCILIATION_RUNBOOK.md',
  files.evidence,
  'docs/evidence/D7_E3_PARTIAL_EXECUTION_AND_FORENSICS_EVIDENCE.md',
  'D7_E3G_PartialStateReadOnlyDiagnostic.js',
  'tests/unit/d7-e3g-partial-state-read-only-diagnostic.test.mjs',
  'docs/phases/D7_E3G_PARTIAL_STATE_READ_ONLY_DIAGNOSTIC_CHANNEL.md',
  'docs/evidence/D7_E3G_PARTIAL_STATE_READ_ONLY_DIAGNOSTIC_EVIDENCE.md',
  files.test,
  'docs/00_INDEX.md',
  'docs/07_WORK_LOG.md',
  'docs/08_DECISION_LOG.md',
  'docs/09_VALIDATION_LOG.md',
  'docs/99_NEXT_AI_HANDOFF.md',
  files.packageJson,
  'scripts/checkers/check-d7-e3g-partial-state-read-only-diagnostic.mjs',
  'scripts/checkers/check-d7-e-owner-approved-one-candidate-production-pilot.mjs',
  'scripts/checkers/check-d7-c-d7-d-candidate-review-and-pilot-plan.mjs',
]);

const statusLines = git(['status', '--short']).split(/\r?\n/).filter(Boolean);
for (const line of statusLines) {
  const file = line.slice(3).trim().replace(/\\/g, '/');
  if (file === 'GUARD.bat' || file.startsWith('_guard/')) continue;
  if (!allowedDirty.has(file)) fail(`UNAPPROVED_DIRTY_FILE_${file.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  if (line[0] !== ' ' && (file === 'GUARD.bat' || file.startsWith('_guard/'))) fail('GUARD_FILE_STAGED');
}

const stagedFiles = git(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean);
for (const file of stagedFiles) {
  if (file === 'GUARD.bat' || file.startsWith('_guard/')) fail('GUARD_FILE_STAGED');
}

console.log('D7_E_OWNER_APPROVED_ONE_CANDIDATE_PRODUCTION_PILOT_CHECK=PASS');
