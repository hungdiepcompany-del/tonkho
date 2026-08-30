import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();

const files = {
  runtime: 'D7_E3V_ExactPostHocAttributionReadOnlyDiagnostic.js',
  test: 'tests/unit/d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.test.mjs',
  checker: 'scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs',
  docs: 'docs/phases/D7_E3V_TO_X_EXACT_POST_HOC_ATTRIBUTION_AND_FIRESTORE_RECONCILIATION_DECISION.md',
  packageJson: 'package.json',
  aggregate: 'scripts/test/run-all-checks.mjs'
};

const requiredPhaseFiles = Object.freeze([
  files.runtime,
  files.test,
  files.checker,
  files.docs
]);

const approvedDirtyFiles = Object.freeze([
  ...requiredPhaseFiles,
  files.packageJson,
  files.aggregate,
  '.codex/agents/coder.toml',
  '.codex/agents/explorer.toml',
  '.codex/agents/reviewer.toml',
  '.codex/agents/verifier.toml',
  '.codex/config.toml',
  'AGENTS.md',
  'docs/12_AI_WORK_LOG.md',
  'docs/13_DECISION_LOG.md',
  'docs/AI_EXECUTION_ROUTING.md',
  'docs/AI_WORKFLOW.md',
  'docs/04_MASTER_PLAN.md',
  'docs/FILE_MANIFEST.md',
  'docs/WORKFLOW_V2_CHANGE_SUMMARY.md',
  'docs/WORKFLOW_V2_FILE_INVENTORY.md',
  'docs/exec-plans/active/SGDS_WRITER_AUTHORITY_V3_CONTROLLER_ENFORCED_SINGLE_WRITER_IMPLEMENTATION.md',
  'docs/exec-plans/active/D7_E4B2_POLICY_REPAIR_WRITER_LIFECYCLE_AND_MR2R_CLOSURE.md',
  'docs/exec-plans/completed/D7_E4B2_POLICY_REPAIR_WRITER_LIFECYCLE_AND_MR2R_CLOSURE.md',
  'docs/exec-plans/completed/D7_E4B2_PRODUCTION_EXECUTION_READINESS_AND_OWNER_GATE.md',
  'docs/exec-plans/completed/SGDS_WRITER_AUTHORITY_V3_INTEGRATED_REPAIR_AND_EXACT_LEASE_DISPOSITION.md',
  'docs/exec-plans/completed/SYNC_GOV1_REPO_GOVERNANCE_BOOTSTRAP.md',
  'scripts/ai/Manage-NonWriterIsolation.ps1',
  'scripts/checkers/check-ai-governance-bootstrap.mjs',
  'scripts/checkers/check-no-secret.ps1',
  'tests/unit/ai-governance-bootstrap.test.mjs',
  'scripts/checkers/check-d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.mjs',
  'scripts/checkers/check-d7-e3r-exact-bounded-production-read-only-adapters.mjs',
  'scripts/checkers/check-d7-e3g-partial-state-read-only-diagnostic.mjs',
  'scripts/checkers/check-d7-e-owner-approved-one-candidate-production-pilot.mjs',
  'scripts/checkers/check-d7-c-d7-d-candidate-review-and-pilot-plan.mjs',
  'docs/00_INDEX.md',
  'docs/07_WORK_LOG.md',
  'docs/08_DECISION_LOG.md',
  'docs/09_VALIDATION_LOG.md',
  'docs/99_NEXT_AI_HANDOFF.md',
  'docs/phases/D7_E3Y_TO_Z0_OWNER_EVIDENCE_COLLECTION_IMMUTABLE_ATTRIBUTION_REVIEW_AND_EXACT_RECONCILIATION_DECISION.md',
  'docs/phases/D7_E3Z_OWNER_IMMUTABLE_EVIDENCE_UNAVAILABLE_FAIL_CLOSED_CLOSEOUT.md',
  'docs/phases/D7_E4A_OWNER_UNPROVEN_SHEET_ROW_DISPOSITION_AND_EXACT_RECONCILIATION_PLAN.md',
  'D7_E4A1_BoundedFirestoreIdentityCardinalityReadOnlyProof.js',
  'tests/unit/d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.test.mjs',
  'scripts/checkers/check-d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.mjs',
  'docs/phases/D7_E4A1_BOUNDED_FIRESTORE_IDENTITY_CARDINALITY_READ_ONLY_PROOF.md',
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
]);

const knownGuardDirtyFiles = new Set([
  'GUARD.bat',
  '_guard/PROJECT_GUARD.config.bat',
  '_guard/PROJECT_GUARD_ENGINE.bat',
  '_guard/README.md'
]);
const knownGuardDirtyPrefixes = ['_guard/deploy/'];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).replace(/\s+$/g, '');
}

function normalizeStatusPath_(value) {
  return String(value || '').trim().replace(/\\/g, '/');
}

function safeCodeFile_(value) {
  return normalizeStatusPath_(value).replace(/[^A-Z0-9]+/gi, '_').toUpperCase();
}

function parseStatusLine_(line) {
  const raw = String(line || '');
  if (!raw.trim()) return null;
  const indexStatus = raw[0] || ' ';
  const worktreeStatus = raw[1] || ' ';
  const file = normalizeStatusPath_(raw.slice(3).split(' -> ').pop());
  return {
    raw,
    file,
    staged: indexStatus !== ' ' && indexStatus !== '?',
    untracked: indexStatus === '?' && worktreeStatus === '?',
    dirty: worktreeStatus !== ' ' || (indexStatus === '?' && worktreeStatus === '?')
  };
}

function isKnownGuardDirtyPath_(file) {
  return knownGuardDirtyFiles.has(file) || knownGuardDirtyPrefixes.some(prefix => file.startsWith(prefix));
}

export function evaluateD7E3VPhaseFileState_({
  statusLines = [],
  trackedFiles = [],
  existingFiles = [],
  requiredFiles = requiredPhaseFiles,
  allowedDirtyFiles = approvedDirtyFiles
} = {}) {
  const required = new Set([...requiredFiles].map(normalizeStatusPath_));
  const allowed = new Set([...allowedDirtyFiles].map(normalizeStatusPath_));
  const tracked = new Set([...trackedFiles].map(normalizeStatusPath_));
  const existing = new Set([...existingFiles].map(normalizeStatusPath_));
  const parsed = statusLines.map(parseStatusLine_).filter(Boolean);
  const statusByFile = new Map(parsed.map(entry => [entry.file, entry]));
  const approvedDirty = [];
  const fileStates = {};

  for (const file of required) {
    const status = statusByFile.get(file);
    const existsInWorkingTree = existing.has(file);
    const trackedInHead = tracked.has(file);
    if (!existsInWorkingTree) {
      return { ok: false, failureCode: `MISSING_FILE_${safeCodeFile_(file)}`, mode: 'INVALID_MISSING_REQUIRED_FILE', fileStates };
    }
    if (status?.staged) {
      return { ok: false, failureCode: `STAGED_FILE_${safeCodeFile_(file)}`, mode: 'INVALID_STAGED_FILE', fileStates };
    }
    if (!trackedInHead && !status?.untracked) {
      return { ok: false, failureCode: `REQUIRED_FILE_NOT_TRACKED_${safeCodeFile_(file)}`, mode: 'INVALID_REQUIRED_FILE_NOT_TRACKED', fileStates };
    }
    if (status?.dirty || status?.untracked) {
      if (!allowed.has(file)) {
        return { ok: false, failureCode: `UNAPPROVED_DIRTY_FILE_${safeCodeFile_(file)}`, mode: 'INVALID_UNAPPROVED_DIRTY_FILE', fileStates };
      }
      approvedDirty.push(file);
      fileStates[file] = status.untracked ? 'UNTRACKED_APPROVED' : 'DIRTY_APPROVED';
    } else {
      fileStates[file] = trackedInHead ? 'TRACKED_CLEAN' : 'PRESENT_UNTRACKED_STATUS_MISSING';
    }
  }

  for (const status of parsed) {
    if (isKnownGuardDirtyPath_(status.file)) continue;
    if (status.staged) {
      return { ok: false, failureCode: `STAGED_FILE_${safeCodeFile_(status.file)}`, mode: 'INVALID_STAGED_FILE', fileStates };
    }
    if ((status.dirty || status.untracked) && !allowed.has(status.file)) {
      return { ok: false, failureCode: `UNAPPROVED_DIRTY_FILE_${safeCodeFile_(status.file)}`, mode: 'INVALID_UNAPPROVED_DIRTY_FILE', fileStates };
    }
  }

  if (!approvedDirty.length) {
    return { ok: true, mode: 'ALL_REQUIRED_FILES_TRACKED_AND_CLEAN', approvedDirtyFiles: approvedDirty, fileStates };
  }
  if (approvedDirty.some(file => file === files.runtime || file === files.test || file === files.checker)) {
    return { ok: true, mode: 'APPROVED_LOCAL_IMPLEMENTATION_CHANGES', approvedDirtyFiles: approvedDirty, fileStates };
  }
  return { ok: true, mode: 'MIXED_APPROVED_CORRECTIVE_STATE', approvedDirtyFiles: approvedDirty, fileStates };
}

function withoutComments_(text) {
  return String(text || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function countFunctionDeclarations_(text, name) {
  return [...withoutComments_(text).matchAll(new RegExp(`\\bfunction\\s+${name}\\s*\\(`, 'g'))].length;
}

function assertIncludes_(failures, text, needle, code) {
  if (!String(text || '').includes(needle)) failures.push(code);
}

function assertMatches_(failures, text, pattern, code) {
  if (!pattern.test(String(text || ''))) failures.push(code);
}

function assertNotMatches_(failures, text, pattern, code) {
  if (pattern.test(String(text || ''))) failures.push(code);
}

export function evaluateD7E3VSourceSemantics_({
  runtime = '',
  unitTest = '',
  docs = '',
  packageJsonText = '',
  aggregateCheckText = ''
} = {}) {
  const failures = [];

  assertIncludes_(failures, runtime, 'D7_E3V_TO_X_EXACT_POST_HOC_ATTRIBUTION_AND_FIRESTORE_RECONCILIATION_DECISION', 'PHASE_MARKER_MISSING');
  if (countFunctionDeclarations_(runtime, 'runD7E3VExactPostHocAttributionReadOnly') !== 1) failures.push('PUBLIC_ENTRYPOINT_DECLARATION_COUNT_NOT_ONE');
  if (countFunctionDeclarations_(runtime, 'createD7E3VExactPostHocAttributionReadOnlyRunner_') !== 1) failures.push('RUNNER_DECLARATION_COUNT_NOT_ONE');

  for (const marker of [
    'ATTRIBUTION_PROVEN_D7_E',
    'ATTRIBUTION_PROVEN_EXTERNAL_OR_USER_CREATED',
    'ATTRIBUTION_CONFLICT',
    'ATTRIBUTION_UNPROVEN',
    'NO_ACTION_REQUIRED',
    'POST_HOC_RECONCILIATION_EVENT_REVIEW_REQUIRED',
    'FIRESTORE_STATE_RECONCILIATION_REVIEW_REQUIRED',
    'OWNER_MANUAL_REVIEW_REQUIRED',
    'FRESH_READ_ONLY_RERUN_REQUIRED',
    "automaticExecutionAllowed: 'NO'",
    "reconciliationPlanExecuted: 'NO'",
    'DURABLE_WRITE_ATTEMPT_LINK_EXACT',
    'DURABLE_AUDIT_LINK_EXACT',
    'DURABLE_ATTACHMENT_RECORD_LINK_EXACT',
    "EXACT_DURABLE_LINK_REQUIRED: 'YES'",
    "CONTENT_SIMILARITY_ALONE_ATTRIBUTION_PROHIBITED: 'YES'",
    "GENERIC_UNKNOWN_WRITE_OUTCOME_ATTRIBUTION_PROHIBITED: 'YES'",
    "CALLER_ATTRIBUTION_LABEL_ATTRIBUTION_PROHIBITED: 'YES'",
    'JOB_IDENTITY_EXACT',
    'COMMIT_PLAN_IDENTITY_EXACT',
    'GMAIL_SOURCE_IDENTITY_EXACT',
    'DRIVE_XML_IDENTITY_EXACT',
    'DRIVE_XML_CONTENT_HASH_MATCH',
    'DRIVE_PDF_IDENTITY_EXACT',
    'DRIVE_PDF_CONTENT_HASH_MATCH',
    'SHEET_ROW_IDENTITY_EXACT',
    'SHEET_TRANSACTION_IDENTITY_EXACT',
    'SHEET_CONTENT_MATCH',
    'CONFLICTING_ATTRIBUTION_EVIDENCE_PRESENT',
    'CONCURRENT_CHANGE_DETECTED',
    'ATTRIBUTION_READ_INCOMPLETE',
    'BLOCKED_D7_E3V_ATTRIBUTION_READ_INCOMPLETE',
    'createD7E3RExactBoundedProductionReadOnlyAdapters_',
    'productionReaders.readGmailEvidence',
    'productionReaders.readDriveEvidence',
    'productionReaders.readSheetsEvidence',
    'productionReaders.readFirestoreEvidence',
    'readSnapshot',
    "runtimeMutation: 'NONE'",
    "productionIdentifiersEmitted: 'NO'",
    'sanitizeObjectD7E3V_',
    'safeErrorCodeD7E3V_'
  ]) {
    assertIncludes_(failures, runtime, marker, `RUNTIME_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }

  assertMatches_(failures, runtime, /evidence\.safeFields\.JOB_IDENTITY_EXACT === 'YES'[\s\S]*evidence\.safeFields\.COMMIT_PLAN_IDENTITY_EXACT === 'YES'[\s\S]*evidence\.safeFields\.DRIVE_XML_IDENTITY_EXACT === 'YES'[\s\S]*evidence\.safeFields\.DRIVE_PDF_IDENTITY_EXACT === 'YES'[\s\S]*evidence\.safeFields\.SHEET_ROW_IDENTITY_EXACT === 'YES'[\s\S]*evidence\.safeFields\.SHEET_TRANSACTION_IDENTITY_EXACT === 'YES'[\s\S]*evidence\.safeFields\.SHEET_CONTENT_MATCH === 'YES'[\s\S]*evidence\.durableLinkExact/, 'PROVEN_D7_E_MANDATORY_EXACT_EVIDENCE_CHAIN_MISSING');
  assertMatches_(failures, runtime, /if \(!evidence\.durableLinkExact\) reasonCodes\.push\('ATTRIBUTION_DURABLE_LINK_MISSING'\)/, 'DURABLE_LINK_MISSING_REASON_NOT_ENFORCED');
  assertMatches_(failures, runtime, /if \(evidence\.conflict \|\| evidence\.concurrency\.concurrentChange\)[\s\S]*ATTRIBUTION_CONFLICT/, 'CONFLICT_OR_CONCURRENT_CHANGE_PRECEDENCE_MISSING');
  assertMatches_(failures, runtime, /if \(evidence\.readIncomplete\) return 'BLOCKED_D7_E3V_ATTRIBUTION_READ_INCOMPLETE'/, 'INCOMPLETE_READ_FAIL_CLOSED_STATUS_MISSING');

  for (const marker of [
    'GMAIL_MUTATION_COUNT: 0',
    'DRIVE_MUTATION_COUNT: 0',
    'SHEETS_MUTATION_COUNT: 0',
    'FIRESTORE_MUTATION_COUNT: 0',
    'TRIGGER_MUTATION_COUNT: 0',
    'DESTRUCTIVE_OPERATION_COUNT: 0',
    'REPAIR_OPERATION_COUNT: 0',
    'RECONCILIATION_WRITE_COUNT: 0',
    'PRODUCTION_MUTATION_COUNT: 0',
    'READ_ONLY_GMAIL_CALL_COUNT',
    'READ_ONLY_DRIVE_CALL_COUNT',
    'READ_ONLY_SHEETS_CALL_COUNT',
    'READ_ONLY_FIRESTORE_CALL_COUNT',
    'READ_CALLS_WITHIN_MAXIMA'
  ]) {
    assertIncludes_(failures, runtime, marker, `COUNTER_OR_READ_LIMIT_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }

  for (const forbidden of [
    /GmailApp\.search\s*\(/,
    /GmailApp\.getInboxThreads\s*\(/,
    /searchGmail\s*\(/,
    /\.getFiles\s*\(/,
    /\.searchFiles\s*\(/,
    /\.getFolders\s*\(/,
    /\.getDataRange\s*\(/,
    /\.createTextFinder\s*\(/,
    /getSheetValues\s*\(/,
    /runQuery\s*\(/,
    /listCollection\s*\(/,
    /listDocuments\s*\(/,
    /documents:list/,
    /collectionIds/,
    /\.setProperty\s*\(/,
    /\.deleteProperty\s*\(/,
    /ScriptApp\.newTrigger/,
    /ScriptApp\.deleteTrigger/,
    /\.(addLabel|removeLabel|markRead|markUnread|moveToTrash)\s*\(/,
    /\.(createFile|createFolder|setTrashed|setName|setContent)\s*\(/,
    /\.(appendRow|setValue|setValues|deleteRow|clear)\s*\(/,
    /method:\s*['"`](post|put|patch|delete)['"`]/i,
    /runTransaction\s*\(/,
    /createDocument\s*\(/,
    /updateDocument\s*\(/,
    /deleteDocument\s*\(/,
    /runD7EOwnerApprovedOneCandidateProductionPilot\s*\(/,
    /runD6jCOneRecordProductionMutation\s*\(/,
    /saveD7EReconciliationReport_\s*\(/,
    /appendD7EAuditEvent_\s*\(/,
    /maybeMarkD7EReconciliationRequired_\s*\(/,
    /clasp\s+(push|deploy|run)/i,
    /firebase\s+deploy/i,
    /gcloud\s+deploy/i
  ]) {
    assertNotMatches_(failures, runtime, forbidden, `FORBIDDEN_RUNTIME_PATTERN_${forbidden.toString().replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }

  for (const marker of [
    '17 generic unknown-write marker does not prove origin',
    '20 missing durable link returns ATTRIBUTION_UNPROVEN',
    '24 concurrent change prevents attribution decision',
    '25 incomplete read fails closed',
    '27 content similarity alone is insufficient',
    '35 automaticExecutionAllowed remains NO',
    '36 reconciliation plan is never executed',
    '37 all mutation counters remain zero',
    '38 no broad Firestore listing occurs',
    '39 no Sheet scan occurs',
    '41 raw identifiers are redacted',
    '42 raw exceptions are redacted'
  ]) {
    assertIncludes_(failures, unitTest, marker, `UNIT_TEST_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }

  for (const marker of [
    'PHASE=D7_E3V_TO_X_EXACT_POST_HOC_ATTRIBUTION_AND_FIRESTORE_RECONCILIATION_DECISION',
    'MODE=CONTINUOUS_FAIL_CLOSED_EXACT_READ_ONLY_ATTRIBUTION_AND_DECISION',
    'GMAIL_SOURCE_VERIFIED=YES',
    'SHEET_CANONICAL_ROW_EXACT=YES',
    'SHEET_ATTRIBUTION_PROVEN=NO',
    'FIRESTORE_JOB_STATE=VALIDATED_NOT_COMPLETED',
    'UNKNOWN_WRITE_OUTCOME_EVIDENCE_PRESENT=YES',
    'ALL_PRODUCTION_READ_CHANNELS=READ_OK',
    'PRODUCTION_DATA_MUTATION=NONE',
    'D7_E_PILOT_RERUN=NO',
    'EXACT_DURABLE_LINK_REQUIRED=YES',
    'CONTENT_SIMILARITY_ALONE_ATTRIBUTION_PROHIBITED=YES',
    'GENERIC_UNKNOWN_WRITE_OUTCOME_ATTRIBUTION_PROHIBITED=YES',
    'RECONCILIATION_PLAN_EXECUTED=NO',
    'SAFE_NEXT_ACTION=OWNER_RUN_EXACT_D7_E3V_ATTRIBUTION_READ_ONLY_ONCE_AND_RETURN_COMPLETE_RESULT'
  ]) {
    assertIncludes_(failures, docs, marker, `DOC_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }

  assertIncludes_(failures, packageJsonText, '"check:d7-e3v-exact-post-hoc-attribution-read-only"', 'PACKAGE_COMMAND_MISSING');
  assertIncludes_(failures, packageJsonText, 'node scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs', 'PACKAGE_COMMAND_TARGET_MISSING');
  assertIncludes_(failures, aggregateCheckText, 'scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs', 'AGGREGATE_CHECK_INTEGRATION_MISSING');

  for (const text of [runtime, docs]) {
    for (const pattern of [
      /https:\/\/mail\.google\.com\/mail\//,
      /https:\/\/drive\.google\.com\//,
      /https:\/\/docs\.google\.com\/spreadsheets\//,
      /Bearer\s+(?!REDACTED\b)[A-Za-z0-9._-]+/,
      /ya29\.[A-Za-z0-9._-]+/,
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
    ]) {
      assertNotMatches_(failures, text, pattern, 'RAW_PRODUCTION_IDENTIFIER_OR_SECRET_PRESENT');
    }
  }

  if (failures.length) return { ok: false, failureCode: failures[0], failures };
  return { ok: true, failureCode: null, failures: [] };
}

function fail(code) {
  console.error('D7_E3V_EXACT_POST_HOC_ATTRIBUTION_READ_ONLY_CHECK=FAIL');
  console.error(`FAILED_GATE=${code}`);
  process.exit(1);
}

function runCheck() {
  for (const file of Object.values(files)) {
    if (!exists(file)) fail(`MISSING_FILE_${safeCodeFile_(file)}`);
  }

  const sourceCheck = evaluateD7E3VSourceSemantics_({
    runtime: read(files.runtime),
    unitTest: read(files.test),
    docs: read(files.docs),
    packageJsonText: read(files.packageJson),
    aggregateCheckText: read(files.aggregate)
  });
  if (!sourceCheck.ok) fail(sourceCheck.failureCode);

  const stagedFiles = git(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean);
  if (stagedFiles.length) fail('STAGED_FILES_PRESENT');

  const statusLines = git(['status', '--short', '--untracked-files=all']).split(/\r?\n/).filter(Boolean);
  const trackedFiles = git(['ls-tree', '-r', '--name-only', 'HEAD']).split(/\r?\n/).filter(Boolean);
  const existingFiles = Object.values(files).filter(file => exists(file));
  const phaseState = evaluateD7E3VPhaseFileState_({
    statusLines,
    trackedFiles,
    existingFiles,
    requiredFiles: requiredPhaseFiles,
    allowedDirtyFiles: approvedDirtyFiles
  });
  if (!phaseState.ok) fail(phaseState.failureCode);

  console.log('D7_E3V_EXACT_POST_HOC_ATTRIBUTION_READ_ONLY_CHECK=PASS');
  console.log(`D7_E3V_PHASE_FILE_STATE_MODE=${phaseState.mode}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCheck();
}
