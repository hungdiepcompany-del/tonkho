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

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
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
  'D7_B_ENTRYPOINT_EXECUTED=NO',
  'CANDIDATE_DISCOVERY_EXECUTED=NO',
  'D7_C_APPROVAL_READY=PENDING_RUNTIME_EXECUTION',
  'REMOTE_APPS_SCRIPT_SYNC=PASS_HASH_VERIFIED',
]) {
  assertIncludes(d7bEvidence, marker, `D7_B_EVIDENCE_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const marker of [
  'PHASE=D7_C_CANDIDATE_REVIEW',
  'READ_ONLY_PRODUCTION_INSPECTION=NO_NEW_RUNTIME_EXECUTION',
  'D7_B_SOURCE_COMMIT_PRESENT=YES',
  'D7_B_EVIDENCE_COMMIT_PRESENT=YES',
  'REMOTE_APPS_SCRIPT_SYNC_EVIDENCE=PASS_HASH_VERIFIED',
  'D7_B_ENTRYPOINT_EXECUTED=NO',
  'CANDIDATE_DISCOVERY_EXECUTED=NO',
  'GMAIL_GATE',
  'ATTACHMENT_GATE',
  'DRIVE_GATE',
  'SHEETS_SCHEMA_GATE',
  'SHEETS_DUPLICATE_GATE',
  'FIRESTORE_GATE',
  'CROSS_SYSTEM_IDENTITY_GATE',
  'UNKNOWN',
  'D7_C_STATUS=BLOCKED_CANDIDATE_NOT_ELIGIBLE',
  'CANDIDATE_COUNT=NOT_EVALUATED',
  'CANDIDATE_ELIGIBLE=false',
  'D7_C_BLOCKERS=BLOCKED_EVIDENCE_INCOMPLETE',
  'RAW_PRODUCTION_IDENTIFIERS_COMMITTED=NO',
  'PRODUCTION_MUTATION=NONE',
]) {
  assertIncludes(d7c, marker, `D7_C_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const marker of [
  'PHASE=D7_D_BOUNDED_PRODUCTION_PILOT_EXECUTION_PLAN',
  'D7_D_STATUS=PASS_BLOCKED_EXECUTION_READINESS_PLAN_RECORDED',
  'D7_E_OPENED=false',
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
  'OWNER_MARKER_ACTIONABLE=NO_UNTIL_BLOCKERS_RESOLVED',
  'IDEMPOTENCY_PLAN_DEFINED=YES',
  'FAILURE_CONTAINMENT_DEFINED=YES',
  'RECONCILIATION_PLAN_DEFINED=YES',
  'ROLLBACK_RESUME_MATRIX_DEFINED=YES',
  'NEXT_SAFE_PHASE=D7_B_OWNER_RUN_BOUNDED_READ_ONLY_CANDIDATE_DISCOVERY_ONCE',
  'PRODUCTION_MUTATION=NONE',
]) {
  assertIncludes(d7d, marker, `D7_D_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const marker of [
  'PHASE_BUNDLE=D7_C_PLUS_D7_D',
  'STATUS=PASS_BLOCKED_EXECUTION_READINESS_PLAN_RECORDED',
  'D7_C_STATUS=BLOCKED_CANDIDATE_NOT_ELIGIBLE',
  'D7_D_STATUS=PASS_BLOCKED_EXECUTION_READINESS_PLAN_RECORDED',
  'D7_E_OPENED=false',
  'CLASP_PUSH_RUN=false',
  'DEPLOY_RUN=false',
  'PRODUCTION_MUTATION=NONE',
  'BLOCKER=BLOCKED_EVIDENCE_INCOMPLETE',
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
  files.d7c,
  files.d7d,
  files.bundleEvidence,
  'scripts/checkers/check-d7-c-d7-d-candidate-review-and-pilot-plan.mjs',
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
