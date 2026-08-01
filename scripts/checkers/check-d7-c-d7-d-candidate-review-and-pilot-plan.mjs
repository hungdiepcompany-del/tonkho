import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

function fail(code) {
  console.error('D7_C_D7_D_CANDIDATE_REVIEW_AND_PILOT_PLAN_CHECK=FAIL');
  console.error(`FAILED_GATE=${code}`);
  process.exit(1);
}

function assertIncludes(text, needle, code) {
  if (!text.includes(needle)) fail(code);
}

function assertMatches(text, pattern, code) {
  if (!pattern.test(text)) fail(code);
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).replace(/\s+$/g, '');
}

function assertCommitExists(commit, code) {
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: root, stdio: 'ignore' });
  } catch {
    fail(code);
  }
}

const files = {
  d7c: 'docs/evidence/D7_C_CANDIDATE_REVIEW_EVIDENCE.md',
  d7d: 'docs/phases/D7_D_BOUNDED_PRODUCTION_PILOT_EXECUTION_PLAN.md',
  bundleEvidence: 'docs/evidence/D7_C_D7_D_REVIEW_AND_PLAN_EVIDENCE.md',
  d7bEvidence: 'docs/evidence/D7_B_BOUNDED_READ_ONLY_CANDIDATE_DISCOVERY_EVIDENCE.md',
  packageJson: 'package.json'
};

for (const file of Object.values(files)) {
  if (!exists(file)) fail(`MISSING_FILE_${file.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

assertCommitExists('6a3e8c975ca29c2e753047ad7bfcf305424258bc', 'D7_B_SOURCE_COMMIT_MISSING');
assertCommitExists('8a0328cee28fefee5b4a46278108b0334a2d5d74', 'D7_B_EVIDENCE_COMMIT_MISSING');

const d7c = read(files.d7c);
const d7d = read(files.d7d);
const bundleEvidence = read(files.bundleEvidence);
const d7bEvidence = read(files.d7bEvidence);
const packageJson = JSON.parse(read(files.packageJson));

for (const marker of [
  'D7_B_ENTRYPOINT_EXECUTED=YES_ONCE_BY_OWNER',
  'D7_B_EXECUTION_COUNT=1',
  'CANDIDATE_DISCOVERY_EXECUTED=YES_READ_ONLY',
  'D7_B_RUNTIME_EVIDENCE_STATUS=PASS_SANITIZED_OWNER_RESULT_RECORDED',
  'D7_B_STATUS=PASS_EXACTLY_ONE_ELIGIBLE_CANDIDATE_READY_FOR_OWNER_REVIEW',
  'RUNTIME_SAFETY_RECHECK=PASS',
  'EFFECTIVE_CONFIG_STATUS=PASS',
  'ELIGIBLE_CANDIDATE_COUNT=1',
  'APPROVED_CANDIDATE_COUNT=1',
  'INSPECTED_ATTACHMENT_COUNT=2',
  'ATTACHMENT_VALIDATION_STATUS=PASS',
  'CARDINALITY_STATUS=EXACTLY_ONE_ELIGIBLE_CANDIDATE',
  'FINGERPRINT_STATUS=PASS',
  'GMAIL_DUPLICATE_STATUS=NOT_FOUND',
  'DRIVE_DUPLICATE_STATUS=NOT_FOUND',
  'SHEET_DUPLICATE_STATUS=NOT_FOUND',
  'FIRESTORE_DUPLICATE_STATUS=NOT_FOUND',
  'EXACT_DUPLICATE_COUNT=0',
  'CONFLICT_COUNT=0',
  'READ_BLOCKED_COUNT=0',
  'MUTATION_ATTEMPT_COUNT=0',
  'PRODUCTION_WRITE=NONE',
  'PRODUCTION_MUTATION=NONE',
  'SCRIPT_PROPERTIES_MUTATION_COUNT=0',
  'GMAIL_MUTATION_COUNT=0',
  'DRIVE_MUTATION_COUNT=0',
  'SHEETS_MUTATION_COUNT=0',
  'FIRESTORE_MUTATION_COUNT=0',
  'TRIGGER_MUTATION_COUNT=0',
  'DESTRUCTIVE_OPERATION_COUNT=0',
  'RAW_EMAIL_ADDRESS_LOG_COUNT=0',
  'RAW_EMAIL_SUBJECT_LOG_COUNT=0',
  'RAW_EMAIL_BODY_LOG_COUNT=0',
  'RAW_MESSAGE_ID_LOG_COUNT=0',
  'RAW_XML_LOG_COUNT=0',
  'RAW_PDF_CONTENT_LOG_COUNT=0',
  'CUSTOMER_CONTENT_LOG_COUNT=0',
  'REMOTE_APPS_SCRIPT_SYNC=PASS_HASH_VERIFIED',
]) {
  assertIncludes(d7bEvidence, marker, `D7_B_EVIDENCE_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const [label, pattern] of [
  ['MESSAGE_ID_HASH', /^MESSAGE_ID_HASH=[a-f0-9]{16}$/m],
  ['THREAD_ID_HASH', /^THREAD_ID_HASH=[a-f0-9]{16}$/m],
  ['PDF_SHA256', /^PDF_SHA256=[a-f0-9]{64}$/m],
  ['XML_SHA256', /^XML_SHA256=[a-f0-9]{64}$/m],
  ['ATTACHMENT_SET_SHA256', /^ATTACHMENT_SET_SHA256=[a-f0-9]{64}$/m],
  ['INVOICE_KEY_HASH', /^INVOICE_KEY_HASH=[a-f0-9]{64}$/m],
  ['HASH_INDEX_HASH', /^HASH_INDEX_HASH=[a-f0-9]{64}$/m],
  ['CANDIDATE_FINGERPRINT', /^CANDIDATE_FINGERPRINT=[a-f0-9]{64}$/m],
  ['CANDIDATE_FINGERPRINT_HASH_PREFIX', /^CANDIDATE_FINGERPRINT_HASH_PREFIX=[a-f0-9]{16}$/m],
  ['INVOICE_KEY_HASH_PREFIX', /^INVOICE_KEY_HASH_PREFIX=[a-f0-9]{16}$/m],
  ['HASH_INDEX_HASH_PREFIX', /^HASH_INDEX_HASH_PREFIX=[a-f0-9]{16}$/m],
  ['XML_SHA256_PREFIX', /^XML_SHA256_PREFIX=[a-f0-9]{16}$/m],
  ['PDF_SHA256_PREFIX', /^PDF_SHA256_PREFIX=[a-f0-9]{16}$/m],
]) {
  assertMatches(d7bEvidence, pattern, `D7_B_HASH_SHAPE_INVALID_${label}`);
}

for (const marker of [
  'PHASE=D7_C_CANDIDATE_REVIEW',
  'READ_ONLY_PRODUCTION_INSPECTION=OWNER_SUPPLIED_SANITIZED_RUNTIME_RESULT_ONLY',
  'D7_B_SOURCE_COMMIT_PRESENT=YES',
  'D7_B_EVIDENCE_COMMIT_PRESENT=YES',
  'REMOTE_APPS_SCRIPT_SYNC_EVIDENCE=PASS_HASH_VERIFIED',
  'PREVIOUS_D7_C_STATUS=BLOCKED_CANDIDATE_NOT_ELIGIBLE',
  'PREVIOUS_D7_C_BLOCKER=BLOCKED_EVIDENCE_INCOMPLETE',
  'PREVIOUS_STATUS_SUPERSEDED=YES',
  'SUPERSEDED_BY_OWNER_RUNTIME_EVIDENCE=YES',
  'D7_B_ENTRYPOINT_EXECUTED=YES_ONCE_BY_OWNER',
  'CANDIDATE_DISCOVERY_EXECUTED=YES_READ_ONLY',
  'GMAIL_GATE=PASS_EXACTLY_ONE_MESSAGE',
  'ATTACHMENT_GATE=PASS_ONE_PDF_ONE_XML',
  'DRIVE_GATE=PASS_NOT_FOUND',
  'SHEETS_SCHEMA_GATE=PASS',
  'SHEETS_DUPLICATE_GATE=PASS_NOT_FOUND',
  'FIRESTORE_GATE=PASS_NOT_FOUND',
  'CROSS_SYSTEM_IDENTITY_GATE=PASS_SANITIZED_FINGERPRINT',
  'D7_C_STATUS=PASS_ONE_CANDIDATE_ELIGIBLE',
  'CANDIDATE_COUNT=1',
  'CANDIDATE_ELIGIBLE=true',
  'D7_C_BLOCKERS=NONE',
  'RAW_PRODUCTION_IDENTIFIERS_COMMITTED=NO',
  'PRODUCTION_MUTATION=NONE',
]) {
  assertIncludes(d7c, marker, `D7_C_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const marker of [
  'PHASE=D7_D_BOUNDED_PRODUCTION_PILOT_EXECUTION_PLAN',
  'D7_D_STATUS=PASS_BOUNDED_PILOT_PLAN_READY',
  'D7_E_OPENED=false',
  'D7_E_EXECUTED=false',
  'MAX_GMAIL_CANDIDATES=1',
  'MAX_INVOICES=1',
  'MAX_PDF_ATTACHMENTS=1',
  'MAX_XML_ATTACHMENTS=1',
  'MAX_DRIVE_FILES_CREATED=2',
  'MAX_SHEET_ROWS_INSERTED=1',
  'MAX_SHEET_ROWS_UPDATED=0',
  'MAX_FIRESTORE_JOBS_CREATED=1',
  'MAX_FIRESTORE_ATTACHMENT_RECORDS_CREATED=2',
  'MAX_TRIGGER_CHANGES=0',
  'OWNER_APPROVAL_MARKER=OWNER_APPROVE_D7E_ONE_CANDIDATE_PRODUCTION_PILOT',
  'OWNER_MARKER_ACTIONABLE=YES',
  'OWNER_MARKER_SUPPLIED_FOR_EXECUTION=NO',
  'D7_E_READY_FOR_OWNER_APPROVAL=YES',
  'IDEMPOTENCY_PLAN_DEFINED=YES',
  'FAILURE_CONTAINMENT_DEFINED=YES',
  'RECONCILIATION_PLAN_DEFINED=YES',
  'ROLLBACK_RESUME_MATRIX_DEFINED=YES',
  'NEXT_SAFE_PHASE=D7_E_OWNER_APPROVED_ONE_CANDIDATE_PRODUCTION_PILOT',
  'PRODUCTION_MUTATION=NONE',
]) {
  assertIncludes(d7d, marker, `D7_D_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const marker of [
  'PHASE_BUNDLE=D7_B1_PLUS_D7_C1_PLUS_D7_D1',
  'STATUS=PASS_D7_C_CANDIDATE_APPROVED_D7_E_AWAITING_OWNER_MARKER',
  'D7_B_RUNTIME_EVIDENCE_STATUS=PASS_SANITIZED_OWNER_RESULT_RECORDED',
  'D7_C_PREVIOUS_STATUS_SUPERSEDED=YES',
  'D7_C_STATUS=PASS_ONE_CANDIDATE_ELIGIBLE',
  'D7_D_STATUS=PASS_BOUNDED_PILOT_PLAN_READY',
  'OWNER_MARKER_ACTIONABLE=YES',
  'OWNER_MARKER_SUPPLIED_FOR_EXECUTION=NO',
  'D7_E_READY_FOR_OWNER_APPROVAL=YES',
  'D7_E_OPENED=false',
  'D7_E_EXECUTED=false',
  'CLASP_PUSH_RUN=false',
  'DEPLOY_RUN=false',
  'PRODUCTION_MUTATION=NONE',
  'BLOCKER=OWNER_APPROVAL_REQUIRED',
]) {
  assertIncludes(bundleEvidence, marker, `BUNDLE_EVIDENCE_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const text of [d7c, d7d, bundleEvidence]) {
  for (const forbidden of [
    'clasp push',
    'clasp.cmd push',
    'firebase deploy',
    'gcloud app deploy',
    'ScriptApp.newTrigger',
    'ScriptApp.deleteTrigger',
    '.setProperty(',
    '.deleteProperty(',
    'DriveApp.createFile',
    'Drive.Files.insert',
    '.appendRow(',
    '.setValue(',
    '.setValues(',
    'runD6jCOneRecordProductionMutation(',
    'main(',
  ]) {
    if (text.includes(forbidden)) fail(`FORBIDDEN_PRODUCTION_COMMAND_${forbidden.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }

  for (const pattern of [
    /\b(?:GMAIL_MESSAGE_ID|GMAIL_THREAD_ID|DRIVE_FILE_ID|DRIVE_FOLDER_ID|SPREADSHEET_ID|FIRESTORE_DOCUMENT_ID|OAUTH_TOKEN|ACCESS_TOKEN)\s*=\s*(?!NOT_COMMITTED|REDACTED|UNKNOWN|NOT_EVALUATED|NO_RAW)[A-Za-z0-9_-]{8,}/,
    /https:\/\/mail\.google\.com\/mail\//,
    /https:\/\/drive\.google\.com\//,
    /https:\/\/docs\.google\.com\/spreadsheets\//,
    /Bearer\s+[A-Za-z0-9._-]+/,
  ]) {
    if (pattern.test(text)) fail('RAW_PRODUCTION_IDENTIFIER_OR_SECRET_PATTERN_FOUND');
  }
}

const changedFiles = git(['diff', '--name-only']).split(/\r?\n/).filter(Boolean);
const allowedDirty = new Set([
  'docs/00_INDEX.md',
  'docs/07_WORK_LOG.md',
  'docs/08_DECISION_LOG.md',
  'docs/09_VALIDATION_LOG.md',
  'docs/99_NEXT_AI_HANDOFF.md',
  'docs/phases/D7_B_BOUNDED_READ_ONLY_CANDIDATE_DISCOVERY.md',
  'docs/phases/D7_E_OWNER_APPROVED_ONE_CANDIDATE_PRODUCTION_PILOT.md',
  'docs/architecture/D7_E_SAFE_EXECUTION_CHANNEL_CONTRACT.md',
  'docs/operations/D7_E_SOURCE_SYNC_AND_OWNER_EXECUTION_RUNBOOK.md',
  'docs/evidence/D7_E1_EXECUTION_CHANNEL_IMPLEMENTATION_EVIDENCE.md',
  files.d7bEvidence,
  files.d7c,
  files.d7d,
  files.bundleEvidence,
  'D7_E_OwnerApprovedOneCandidateProductionPilot.js',
  'D7_E3G_PartialStateReadOnlyDiagnostic.js',
  'Operator_Entrypoints.js',
  'tests/unit/d7-e-owner-approved-one-candidate-production-pilot.test.mjs',
  'tests/unit/d7-e3g-partial-state-read-only-diagnostic.test.mjs',
  'scripts/checkers/check-d7-e-owner-approved-one-candidate-production-pilot.mjs',
  'scripts/checkers/check-d7-e3g-partial-state-read-only-diagnostic.mjs',
  'scripts/checkers/check-d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.mjs',
  'scripts/checkers/check-d7-e3r-exact-bounded-production-read-only-adapters.mjs',
  'scripts/checkers/check-d7-c-d7-d-candidate-review-and-pilot-plan.mjs',
  'D7_E3I_ExactProductionConflictForensicAndSafeReconciliationPlan.js',
  'D7_E3R_ExactBoundedProductionReadOnlyAdapters.js',
  'tests/unit/d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.test.mjs',
  'tests/unit/d7-e3r-exact-bounded-production-read-only-adapters.test.mjs',
  'docs/phases/D7_E3I_EXACT_PRODUCTION_CONFLICT_FORENSIC_AND_SAFE_RECONCILIATION_PLAN.md',
  'docs/phases/D7_E3R_TO_U_EXACT_BOUNDED_PRODUCTION_READ_ONLY_ADAPTER_IMPLEMENTATION_SOURCE_SYNC_AND_FRESH_FORENSIC.md',
  'docs/phases/D7_E3G_PARTIAL_STATE_READ_ONLY_DIAGNOSTIC_CHANNEL.md',
  'docs/evidence/D7_E3G_PARTIAL_STATE_READ_ONLY_DIAGNOSTIC_EVIDENCE.md',
  'docs/operations/D7_E_PARTIAL_EXECUTION_RECONCILIATION_RUNBOOK.md',
  'package.json',
]);

for (const file of changedFiles) {
  if (file === 'GUARD.bat' || file.startsWith('_guard/')) continue;
  if (!allowedDirty.has(file)) fail(`UNAPPROVED_DIRTY_FILE_${file.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

const stagedFiles = git(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean);
for (const file of stagedFiles) {
  if (file === 'GUARD.bat' || file.startsWith('_guard/')) fail('GUARD_FILE_STAGED');
}

if (
  packageJson.scripts['check:d7-c-d7-d-candidate-review-and-pilot-plan']
  !== 'node scripts/checkers/check-d7-c-d7-d-candidate-review-and-pilot-plan.mjs'
) {
  fail('PACKAGE_COMMAND_MISSING');
}

console.log('D7_C_D7_D_CANDIDATE_REVIEW_AND_PILOT_PLAN_CHECK=PASS');
