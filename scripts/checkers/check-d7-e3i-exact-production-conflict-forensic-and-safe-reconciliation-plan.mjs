import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

const files = {
  runtime: 'D7_E3I_ExactProductionConflictForensicAndSafeReconciliationPlan.js',
  test: 'tests/unit/d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.test.mjs',
  checker: 'scripts/checkers/check-d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.mjs',
  docs: 'docs/phases/D7_E3I_EXACT_PRODUCTION_CONFLICT_FORENSIC_AND_SAFE_RECONCILIATION_PLAN.md'
};

const allowedDirty = new Set(Object.values(files));
const d7e3rCompanionDirtyFiles = [
  'D7_E3R_ExactBoundedProductionReadOnlyAdapters.js',
  'tests/unit/d7-e3r-exact-bounded-production-read-only-adapters.test.mjs',
  'scripts/checkers/check-d7-e3r-exact-bounded-production-read-only-adapters.mjs',
  'scripts/checkers/check-d7-c-d7-d-candidate-review-and-pilot-plan.mjs',
  'scripts/checkers/check-d7-e-owner-approved-one-candidate-production-pilot.mjs',
  'scripts/checkers/check-d7-e3g-partial-state-read-only-diagnostic.mjs',
  'docs/phases/D7_E3R_TO_U_EXACT_BOUNDED_PRODUCTION_READ_ONLY_ADAPTER_IMPLEMENTATION_SOURCE_SYNC_AND_FRESH_FORENSIC.md',
  'docs/00_INDEX.md',
  'docs/07_WORK_LOG.md',
  'docs/08_DECISION_LOG.md',
  'docs/09_VALIDATION_LOG.md',
  'docs/99_NEXT_AI_HANDOFF.md',
  'package.json',
  'scripts/test/run-all-checks.mjs',
  'D7_E3V_ExactPostHocAttributionReadOnlyDiagnostic.js',
  'tests/unit/d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.test.mjs',
  'scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs',
  'docs/phases/D7_E3V_TO_X_EXACT_POST_HOC_ATTRIBUTION_AND_FIRESTORE_RECONCILIATION_DECISION.md',
  'D7_E4A1_BoundedFirestoreIdentityCardinalityReadOnlyProof.js',
  'tests/unit/d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.test.mjs',
  'scripts/checkers/check-d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.mjs',
  'docs/phases/D7_E4A1_BOUNDED_FIRESTORE_IDENTITY_CARDINALITY_READ_ONLY_PROOF.md',
  'tests/unit/d7-e4a1a-canonical-identity-configuration-read-only-recovery.test.mjs',
  'scripts/checkers/check-d7-e4a1a-canonical-identity-configuration-read-only-recovery.mjs',
  'docs/phases/D7_E4A1A_CANONICAL_IDENTITY_CONFIGURATION_READ_ONLY_RECOVERY.md'
];

const knownGuardDirtyPaths = new Set(['GUARD.bat']);
const knownGuardDirtyPrefixes = ['_guard/deploy/'];
const knownGuardDirtyFiles = new Set([
  '_guard/PROJECT_GUARD.config.bat',
  '_guard/PROJECT_GUARD_ENGINE.bat',
  '_guard/README.md'
]);

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).replace(/\s+$/g, '');
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

function normalizeStatusPath_(value) {
  return String(value || '').trim().replace(/\\/g, '/');
}

function safeCodeFile_(value) {
  return normalizeStatusPath_(value).replace(/[^A-Z0-9]+/gi, '_').toUpperCase();
}

function parseD7E3IStatusLine_(line) {
  const raw = String(line || '');
  if (!raw.trim()) return null;
  const indexStatus = raw[0] || ' ';
  const worktreeStatus = raw[1] || ' ';
  const pathText = normalizeStatusPath_(raw.slice(3).split(' -> ').pop());
  return {
    raw,
    indexStatus,
    worktreeStatus,
    path: pathText,
    staged: indexStatus !== ' ' && indexStatus !== '?',
    untracked: indexStatus === '?' && worktreeStatus === '?',
    dirty: worktreeStatus !== ' ' || (indexStatus === '?' && worktreeStatus === '?')
  };
}

function isKnownGuardDirtyPath_(file) {
  return knownGuardDirtyPaths.has(file) ||
    knownGuardDirtyFiles.has(file) ||
    knownGuardDirtyPrefixes.some(prefix => file.startsWith(prefix));
}

export function evaluateD7E3IPhaseFileState_({
  statusLines = [],
  trackedFiles = [],
  existingFiles = [],
  requiredFiles = Object.values(files),
  allowedDirtyFiles = Object.values(files)
} = {}) {
  const required = new Set([...requiredFiles].map(normalizeStatusPath_));
  const allowed = new Set([...allowedDirtyFiles].map(normalizeStatusPath_));
  const tracked = new Set([...trackedFiles].map(normalizeStatusPath_));
  const existing = new Set([...existingFiles].map(normalizeStatusPath_));
  const parsedStatus = statusLines.map(parseD7E3IStatusLine_).filter(Boolean);
  const statusByFile = new Map(parsedStatus.map(entry => [entry.path, entry]));
  const approvedDirtyFiles = [];
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
      approvedDirtyFiles.push(file);
      fileStates[file] = status.untracked ? 'UNTRACKED_APPROVED' : 'DIRTY_APPROVED';
    } else {
      fileStates[file] = trackedInHead ? 'TRACKED_CLEAN' : 'PRESENT_UNTRACKED_STATUS_MISSING';
    }
  }

  for (const status of parsedStatus) {
    if (isKnownGuardDirtyPath_(status.path)) continue;
    if (status.staged) {
      return { ok: false, failureCode: `STAGED_FILE_${safeCodeFile_(status.path)}`, mode: 'INVALID_STAGED_FILE', fileStates };
    }
    if (status.dirty || status.untracked) {
      if (!allowed.has(status.path)) {
        return { ok: false, failureCode: `UNAPPROVED_DIRTY_FILE_${safeCodeFile_(status.path)}`, mode: 'INVALID_UNAPPROVED_DIRTY_FILE', fileStates };
      }
    }
  }

  if (approvedDirtyFiles.length === 0) {
    return { ok: true, mode: 'ALL_REQUIRED_FILES_TRACKED_AND_CLEAN', approvedDirtyFiles, fileStates };
  }
  if (approvedDirtyFiles.includes(normalizeStatusPath_(files.runtime))) {
    return { ok: true, mode: 'APPROVED_LOCAL_IMPLEMENTATION_CHANGES', approvedDirtyFiles, fileStates };
  }
  if (
    approvedDirtyFiles.every(file => file === normalizeStatusPath_(files.checker) || file === normalizeStatusPath_(files.test))
  ) {
    return { ok: true, mode: 'MIXED_APPROVED_CORRECTIVE_STATE', approvedDirtyFiles, fileStates };
  }
  return { ok: true, mode: 'APPROVED_LOCAL_IMPLEMENTATION_CHANGES', approvedDirtyFiles, fileStates };
}

function fail(code) {
  console.error('D7_E3I_EXACT_PRODUCTION_CONFLICT_FORENSIC_CHECK=FAIL');
  console.error(`FAILED_GATE=${code}`);
  process.exit(1);
}

function runD7E3IExactProductionConflictForensicCheck_() {
  for (const file of Object.values(files)) {
    if (!exists(file)) fail(`MISSING_FILE_${safeCodeFile_(file)}`);
  }

  const runtime = read(files.runtime);
  const unitTest = read(files.test);
  const docs = read(files.docs);
  const manifest = exists('appsscript.json') ? read('appsscript.json') : '';

  assertIncludes(runtime, 'D7_E3I_EXACT_PRODUCTION_CONFLICT_FORENSIC_AND_SAFE_RECONCILIATION_PLAN', 'PHASE_MARKER_MISSING');
  assertIncludes(runtime, 'runD7E3IExactProductionConflictForensicReadOnly', 'PUBLIC_ENTRYPOINT_NAME_MISSING');
  assertIncludes(runtime, 'createD7E3IExactProductionConflictForensicRunner_', 'RUNNER_FACTORY_NAME_MISSING');
  if (countFunctionDeclarations(runtime, 'runD7E3IExactProductionConflictForensicReadOnly') !== 1) fail('PUBLIC_ENTRYPOINT_DECLARATION_COUNT_NOT_ONE');
  if (countFunctionDeclarations(runtime, 'createD7E3IExactProductionConflictForensicRunner_') !== 1) fail('RUNNER_DECLARATION_COUNT_NOT_ONE');

  for (const marker of [
  'RUNTIME_MUTATION: \'NONE\'',
  'PRODUCTION_EXECUTION_IN_TESTS: \'NONE\'',
  'REPAIR_EXECUTION: \'NONE\'',
  'RECONCILIATION_WRITE: \'NONE\'',
  'DEPLOYMENT: \'NONE\'',
  'METADATA',
  'CONFIGURATION',
  'BEFORE_SNAPSHOT',
  'GMAIL_EVIDENCE',
  'DRIVE_XML_EVIDENCE',
  'DRIVE_PDF_EVIDENCE',
  'SHEETS_EVIDENCE',
  'FIRESTORE_EVIDENCE',
  'PERMISSION_DIAGNOSTICS',
  'AFTER_SNAPSHOT',
  'CONCURRENT_CHANGE_STATUS',
  'PRIMARY_CLASSIFICATION',
  'FINDINGS',
  'RECONCILIATION_PLAN',
  'SAFETY_COUNTS',
  'FINAL_STATUS'
]) {
  assertIncludes(runtime, marker, `RUNTIME_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const marker of [
  'GMAIL_MUTATION_COUNT',
  'DRIVE_MUTATION_COUNT',
  'SHEETS_MUTATION_COUNT',
  'FIRESTORE_MUTATION_COUNT',
  'TRIGGER_MUTATION_COUNT',
  'DESTRUCTIVE_OPERATION_COUNT',
  'REPAIR_OPERATION_COUNT',
  'RECONCILIATION_WRITE_COUNT',
  'PRODUCTION_MUTATION_COUNT',
  'READ_ONLY_GMAIL_CALL_COUNT',
  'READ_ONLY_DRIVE_CALL_COUNT',
  'READ_ONLY_SHEETS_CALL_COUNT',
  'READ_ONLY_FIRESTORE_CALL_COUNT'
]) {
  assertIncludes(runtime, marker, `SAFETY_COUNTER_MISSING_${marker}`);
}

for (const marker of [
  'CONSISTENT_ALREADY_COMPLETED',
  'PARTIAL_CONFIRMED_MUTATION',
  'PARTIAL_UNKNOWN_OUTCOME',
  'EXTERNAL_USER_CREATED_STATE',
  'DRIVE_CONTENT_CONFLICT',
  'SHEET_IDENTITY_CONFLICT',
  'FIRESTORE_STATE_CONFLICT',
  'MULTI_SYSTEM_CONFLICT',
  'FORENSICS_INCOMPLETE'
]) {
  assertIncludes(runtime, marker, `PRIMARY_CLASSIFICATION_MISSING_${marker}`);
}

for (const marker of [
  'NO_ACTION_REQUIRED',
  'READBACK_READER_FIX_REQUIRED',
  'POST_HOC_RECONCILIATION_EVENT_REVIEW_REQUIRED',
  'FIRESTORE_STATE_RECONCILIATION_REVIEW_REQUIRED',
  'BOUNDED_DRIVE_REPLACEMENT_REVIEW_REQUIRED',
  'BOUNDED_SHEET_REPAIR_REVIEW_REQUIRED',
  'OWNER_MANUAL_REVIEW_REQUIRED',
  'FRESH_READ_ONLY_RERUN_REQUIRED'
]) {
  assertIncludes(runtime, marker, `PLAN_TYPE_MISSING_${marker}`);
}

for (const marker of [
  'ACTUAL_ZERO_BYTE_FILE',
  'READER_EMPTY_FALLBACK_SUSPECTED',
  'CONTENT_READ_BLOCKED',
  'METADATA_READ_BLOCKED',
  'ZERO_BYTE_UNPROVEN',
  'CONTENT_HASH_MATCH',
  'CONTENT_HASH_MISMATCH',
  'METADATA_CONTENT_SIZE_MISMATCH',
  'failedReadNotHashedAsEmpty',
  "contentReadStatus === 'READ_OK'",
  'NO_TRUSTED_EMPTY_HASH_CONCLUSION',
  'metadataSizeExplicitlyObserved',
  'contentBytesExplicitlyObserved',
  'metadataReadExplicitlySucceeded',
  'contentReadExplicitlySucceeded',
  'readerFallbackPossible',
  'structuredReadErrorPresent',
  'normalizeD7E3IDriveReadStatus_'
]) {
  assertIncludes(runtime, marker, `DRIVE_ZERO_BYTE_CONTRACT_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const marker of [
  '41. zero metadata and empty bytes with absent statuses cannot prove actual zero-byte Drive file',
  '42. explicit metadata READ_OK without content success cannot prove actual zero-byte Drive file',
  '43. explicit content READ_OK without metadata success cannot prove actual zero-byte Drive file',
  '44. content READ_BLOCKED with fallback empty bytes does not hash fallback data',
  '45. positive metadata with explicit successful empty content read is reader fallback suspected'
]) {
  assertIncludes(unitTest, marker, `DRIVE_CORRECTIVE_TEST_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const marker of [
  'ATTRIBUTION_PROVEN_D7_E',
  'ATTRIBUTION_PROVEN_EXTERNAL',
  'ATTRIBUTION_UNPROVEN',
  'timestampOnlyAttributionProhibited',
  'labelOnlyAttributionProhibited',
  'deriveD7E3ISheetAttribution_',
  'jobIdentityExact',
  'commitPlanSheetIdentityExact',
  'rowIdentityExact',
  'auditLinksExactRowIdentity',
  'externalEvidenceLinksExactRowIdentity',
  'conflictingAttributionEvidencePresent',
  'invoiceKeyHashIndexAloneProhibited',
  'PRESENT_BUT_NOT_ATTRIBUTION_PROOF',
  'SHEET_ROW_ABSENT',
  'SHEET_ROW_EXACT',
  'SHEET_ROW_AMBIGUOUS',
  'SHEET_CONTENT_CONFLICT'
]) {
  assertIncludes(runtime, marker, `SHEET_ATTRIBUTION_CONTRACT_MISSING_${marker}`);
}

for (const marker of [
  '46. label-only D7-E attribution is downgraded to unproven without durable links',
  '47. completed Firestore job without exact row linkage cannot produce CONSISTENT_ALREADY_COMPLETED',
  '48. timestamp-only row evidence remains attribution unproven',
  '49. InvoiceKey and HashIndex match without audit linkage remains attribution unproven',
  '50. explicit external durable linkage proves external Sheet attribution',
  '51. conflicting D7-E and external attribution evidence fails closed'
]) {
  assertIncludes(unitTest, marker, `ATTRIBUTION_CORRECTIVE_TEST_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const marker of [
  'exactPathContract',
  'FIRESTORE_JOB_ABSENT',
  'FIRESTORE_JOB_IDENTITY_CONFLICT',
  'FIRESTORE_JOB_STATE_CONFLICT',
  'FIRESTORE_COMMIT_PLAN_ABSENT',
  'FIRESTORE_COMMIT_PLAN_CONFLICT',
  'FIRESTORE_ATTACHMENT_EVIDENCE_ABSENT',
  'FIRESTORE_AUDIT_EVIDENCE_ABSENT',
  'FIRESTORE_LEASE_CONFLICT',
  'FIRESTORE_RECONCILIATION_CONFLICT',
  'FIRESTORE_READ_BLOCKED',
  'FIRESTORE_FORENSICS_INCOMPLETE',
  'FIRESTORE_STATE_CONSISTENT',
  'commitPlanExact',
  'expectedDriveIdentitiesExact',
  'expectedSheetTransactionIdentityExact'
]) {
  assertIncludes(runtime, marker, `FIRESTORE_CONTRACT_MISSING_${marker}`);
}

for (const marker of [
  'NO_CONCURRENT_CHANGE_DETECTED',
  'CONCURRENT_CHANGE_DETECTED',
  'CONCURRENT_CHANGE_CHECK_INCOMPLETE',
  'BEFORE_AFTER_SNAPSHOT_MISMATCH',
  'FRESH_READ_ONLY_RERUN_REQUIRED'
]) {
  assertIncludes(runtime, marker, `CONCURRENCY_CONTRACT_MISSING_${marker}`);
}

for (const marker of [
  'GMAIL_SOURCE_VERIFIED',
  'GMAIL_SOURCE_CONFLICT',
  'DRIVE_XML_ACTUAL_ZERO_BYTE',
  'DRIVE_PDF_ACTUAL_ZERO_BYTE',
  'DRIVE_XML_READER_EMPTY_FALLBACK_SUSPECTED',
  'DRIVE_PDF_READER_EMPTY_FALLBACK_SUSPECTED',
  'DRIVE_XML_CONTENT_HASH_MISMATCH',
  'DRIVE_PDF_CONTENT_HASH_MISMATCH',
  'DRIVE_METADATA_CONTENT_SIZE_MISMATCH',
  'DRIVE_DUPLICATE_AMBIGUITY',
  'SHEET_CANONICAL_ROW_EXACT',
  'SHEET_CANONICAL_ROW_ABSENT',
  'SHEET_CANONICAL_ROW_AMBIGUOUS',
  'SHEET_IDENTITY_CONFLICT',
  'SHEET_ATTRIBUTION_UNPROVEN',
  'SHEET_ATTRIBUTION_PROVEN_D7_E',
  'SHEET_ATTRIBUTION_PROVEN_EXTERNAL',
  'FIRESTORE_JOB_VALIDATED_NOT_COMPLETED',
  'FIRESTORE_JOB_COMPLETED',
  'FIRESTORE_JOB_IDENTITY_CONFLICT',
  'FIRESTORE_COMMIT_PLAN_CONFLICT',
  'FIRESTORE_RECONCILIATION_CONFLICT',
  'FIRESTORE_AUDIT_ATTRIBUTION_MISSING',
  'UNKNOWN_WRITE_OUTCOME_EVIDENCE_PRESENT',
  'CONFIRMED_D7_E_MUTATION_EVIDENCE_PRESENT',
  'CONCURRENT_STATE_CHANGE',
  'FORENSIC_READ_PERMISSION_BLOCKER',
  'FORENSIC_EVIDENCE_INCOMPLETE'
]) {
  assertIncludes(runtime + unitTest, marker, `FINDING_CODE_MISSING_${marker}`);
}

for (const marker of [
  'D7_E3I_PERMISSION_REASON_CODES_',
  'D7_E3I_MINIMUM_SCOPE_MATRIX_',
  'createD7E3IPermissionDiagnostics_',
  'createD7E3IPermissionStatus_',
  'normalizeD7E3IPermissionReason_',
  'addD7E3IReadIssueFinding_',
  'publicD7E3IPermissionStatus_',
  'GMAIL_PERMISSION_STATUS',
  'DRIVE_XML_PERMISSION_STATUS',
  'DRIVE_PDF_PERMISSION_STATUS',
  'SHEETS_PERMISSION_STATUS',
  'FIRESTORE_PERMISSION_STATUS',
  'channelFindingCodes',
  'BROAD_SCOPE_ADDITION_REQUIRED',
  'CLOUD_PLATFORM_SCOPE_REQUIRED',
  'PRODUCTION_PERMISSION_PROBE_EXECUTED'
]) {
  assertIncludes(runtime, marker, `PERMISSION_DIAGNOSTIC_RUNTIME_MARKER_MISSING_${marker}`);
}

for (const marker of [
  'OAUTH_SCOPE_MISSING',
  'OAUTH_REAUTHORIZATION_REQUIRED',
  'RESOURCE_ACCESS_DENIED',
  'EXECUTION_IDENTITY_MISMATCH',
  'FIRESTORE_AUTHORIZATION_FAILED',
  'FIRESTORE_PROJECT_OR_DATABASE_MISMATCH',
  'INVALID_EXACT_RESOURCE_REFERENCE',
  'TRANSPORT_FAILED',
  'RESOURCE_NOT_FOUND',
  'ADAPTER_PERMISSION_CLASSIFICATION_INCOMPLETE',
  'UNKNOWN_READ_BLOCKER'
]) {
  assertIncludes(runtime + unitTest, marker, `PERMISSION_REASON_CODE_MISSING_${marker}`);
}

for (const marker of [
  '64. Gmail OAuth scope missing is classified separately from generic permission blocker',
  '65. Gmail mailbox access denied is separated from OAuth scope failure',
  '66. unavailable default Gmail adapter is a diagnostic defect, not proven OAuth or ACL denial',
  '67. Drive XML OAuth scope missing is channel-attributed',
  '68. Drive XML file ACL denial is channel-attributed',
  '69. Drive PDF file ACL denial is distinct from Drive XML diagnostics',
  '70. Sheets OAuth scope missing is separated from spreadsheet ACL failure',
  '71. spreadsheet access denied is a resource-access blocker',
  '72. Firestore IAM or API authorization failure is classified as Firestore authorization',
  '73. Firestore project or database mismatch is not collapsed into Gmail or Sheets permission',
  '74. Firestore exact document not found is evidence absence, not permission denied',
  '75. transport failure is diagnostic incomplete, not a permission-denied finding',
  '76. execution identity mismatch is a distinct blocker category',
  '77. unknown adapter read error fails closed without fabricating OAuth or ACL cause',
  '78. all five channel permission diagnostics are independently visible',
  '79. repeated read-permission finding codes retain channel attribution in the summary log',
  '80. permission diagnostics redact raw user and token-shaped error text',
  '81. permission blockers still keep every mutation counter at zero',
  '82. permission diagnostics preserve read-call maxima and do not widen bounded reads',
  '83. minimum-scope matrix is explicit and Cloud Platform broad scope is not required'
]) {
  assertIncludes(unitTest, marker, `PERMISSION_DIAGNOSTIC_TEST_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const forbidden of [
  /\.setProperty\s*\(/,
  /\.deleteProperty\s*\(/,
  /ScriptApp\.newTrigger/,
  /ScriptApp\.deleteTrigger/,
  /GmailApp\./,
  /DriveApp\./,
  /SpreadsheetApp/,
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
  /deleteDocument\s*\(/,
  /clasp\s+push/i,
  /clasp\s+deploy/i,
  /firebase\s+deploy/i,
  /gcloud\s+deploy/i,
  /git\s+commit/i,
  /git\s+push/i
]) {
  assertNotMatches(runtime, forbidden, `FORBIDDEN_RUNTIME_PATTERN_${forbidden.toString().replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const pattern of [
  /runD7EOwnerApprovedOneCandidateProductionPilot\s*\(/,
  /runD6jCOneRecordProductionMutation\s*\(/,
  /appendAndVerifyD7ESheetTransaction_\s*\(/,
  /writeAndVerifyD7EDriveArtifacts_\s*\(/,
  /saveD7EAttachmentRecords_\s*\(/,
  /transitionD7EJob_\s*\(/,
  /appendD7EAuditEvent_\s*\(/,
  /saveD7EReconciliationReport_\s*\(/
]) {
  assertNotMatches(runtime, pattern, 'D7_E_OR_D6J_MUTATION_ENTRYPOINT_REACHABLE');
}

assertNotMatches(manifest, /cloud-platform/i, 'CLOUD_PLATFORM_SCOPE_PRESENT_IN_MANIFEST');
assertNotMatches(unitTest, /gas\.call\(['"]runD7E3IExactProductionConflictForensicReadOnly['"]/, 'PUBLIC_PRODUCTION_ENTRYPOINT_CALLED_BY_TEST');
assertNotMatches(runtime, /error\.message|JSON\.stringify\(error\)|logger\.log\(error/i, 'RAW_ADAPTER_ERROR_LOGGING');
assertNotMatches(runtime, /candidate[sA-Za-z0-9_]*\s*\[\s*0\s*\]/, 'FIRST_RESULT_SELECTION_AFTER_CANDIDATE_MATCH');
assertNotMatches(runtime, /metadataReadStatus\s*=\s*input\.metadataReadStatus\s*\|\|[\s\S]{0,80}READ_OK/, 'METADATA_STATUS_DEFAULTS_TO_READ_OK');
assertNotMatches(runtime, /contentReadStatus\s*=\s*input\.contentReadStatus\s*\|\|[\s\S]{0,120}READ_OK/, 'CONTENT_STATUS_DEFAULTS_TO_READ_OK');
assertNotMatches(runtime, /contentReadStatus === 'READ_OK' && bytesPresent/, 'BYTES_PRESENCE_IMPLIES_READ_SUCCESS');
assertNotMatches(runtime, /metadataSize === 0 && blobByteLength === 0\) \{[\s\S]{0,180}ACTUAL_ZERO_BYTE_FILE/, 'ACTUAL_ZERO_BYTE_WITHOUT_EXPLICIT_READ_PROOF');
assertNotMatches(runtime, /const attributionStatus =\s*input\.attributionStatus/, 'LABEL_ONLY_ATTRIBUTION_TRUSTED');
assertNotMatches(runtime, /input\.attributionStatus\s*===\s*['"]ATTRIBUTION_PROVEN_/, 'CALLER_LABEL_CAN_PROVE_ATTRIBUTION');
assertNotMatches(runtime, /analysis\.sheets\.attributionStatus === 'ATTRIBUTION_PROVEN_D7_E'\s*\|\|\s*analysis\.firestore\.jobCompleted/, 'COMPLETED_JOB_BYPASSES_ATTRIBUTION');
assertNotMatches(runtime, /\(analysis\.sheets\.attributionStatus === 'ATTRIBUTION_PROVEN_D7_E' \|\| analysis\.firestore\.jobCompleted\)/, 'COMPLETED_JOB_ALONE_INSUFFICIENT');

for (const pattern of [
  /https:\/\/mail\.google\.com\/mail\//,
  /https:\/\/drive\.google\.com\//,
  /https:\/\/docs\.google\.com\/spreadsheets\//,
  /Bearer\s+[A-Za-z0-9._-]+/,
  /ya29\.[A-Za-z0-9._-]+/,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  /tonkhohd/i,
  /1[A-Za-z0-9_-]{20,}/,
  /[a-f0-9]{64}/i
]) {
  assertNotMatches(runtime, pattern, 'PRIVATE_VALUE_OR_PRODUCTION_IDENTIFIER_IN_RUNTIME');
  assertNotMatches(docs, pattern, 'PRIVATE_VALUE_OR_PRODUCTION_IDENTIFIER_IN_DOCS');
}

for (const marker of [
  'MODE=LOCAL_IMPLEMENTATION_AND_TEST_ONLY',
  'PRODUCTION_EXECUTION=NOT_RUN',
  'CLASP_PUSH=NOT_RUN',
  'DEPLOY=NOT_RUN',
  'RUNTIME_MUTATION=NONE',
  'Evidence Versus Inference',
  'Drive Zero-Byte Decision Table',
  'Sheet Attribution Decision Table',
  'Firestore Evidence Model',
  'Classification Precedence',
  'Reconciliation Plan Types',
  'Zero-Mutation Guarantees',
  'NEXT_OWNER_GATED_PHASE=SOURCE_SYNC_AND_READ_ONLY_PRODUCTION_EXECUTION_REVIEW'
]) {
  assertIncludes(docs, marker, `DOC_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

  const statusLines = git(['status', '--short']).split(/\r?\n/).filter(Boolean);
  const stagedFiles = git(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean);
  if (stagedFiles.length) fail('STAGED_FILES_PRESENT');
  const trackedFiles = git(['ls-tree', '-r', '--name-only', 'HEAD']).split(/\r?\n/).filter(Boolean);
  const existingFiles = Object.values(files).filter(file => exists(file));
  const phaseFileState = evaluateD7E3IPhaseFileState_({
    statusLines,
    trackedFiles,
    existingFiles,
    requiredFiles: Object.values(files),
    allowedDirtyFiles: Object.values(files).concat(d7e3rCompanionDirtyFiles)
  });
  if (!phaseFileState.ok) fail(phaseFileState.failureCode);

  console.log('D7_E3I_EXACT_PRODUCTION_CONFLICT_FORENSIC_CHECK=PASS');
  console.log(`D7_E3I_PHASE_FILE_STATE_MODE=${phaseFileState.mode}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runD7E3IExactProductionConflictForensicCheck_();
}
