import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const files = {
  adapter: 'D7_E3R_ExactBoundedProductionReadOnlyAdapters.js',
  forensic: 'D7_E3I_ExactProductionConflictForensicAndSafeReconciliationPlan.js',
  test: 'tests/unit/d7-e3r-exact-bounded-production-read-only-adapters.test.mjs',
  e3iTest: 'tests/unit/d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.test.mjs',
  checker: 'scripts/checkers/check-d7-e3r-exact-bounded-production-read-only-adapters.mjs',
  docs: 'docs/phases/D7_E3R_TO_U_EXACT_BOUNDED_PRODUCTION_READ_ONLY_ADAPTER_IMPLEMENTATION_SOURCE_SYNC_AND_FRESH_FORENSIC.md',
  e3iDocs: 'docs/phases/D7_E3I_EXACT_PRODUCTION_CONFLICT_FORENSIC_AND_SAFE_RECONCILIATION_PLAN.md',
  index: 'docs/00_INDEX.md',
  workLog: 'docs/07_WORK_LOG.md',
  decisionLog: 'docs/08_DECISION_LOG.md',
  validationLog: 'docs/09_VALIDATION_LOG.md',
  handoff: 'docs/99_NEXT_AI_HANDOFF.md',
  packageJson: 'package.json',
  manifest: 'appsscript.json'
};

const phaseFiles = new Set([
  files.adapter,
  files.forensic,
  files.test,
  files.e3iTest,
  files.checker,
  'scripts/checkers/check-d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.mjs',
  'scripts/checkers/check-d7-c-d7-d-candidate-review-and-pilot-plan.mjs',
  'scripts/checkers/check-d7-e-owner-approved-one-candidate-production-pilot.mjs',
  'scripts/checkers/check-d7-e3g-partial-state-read-only-diagnostic.mjs',
  files.docs,
  files.e3iDocs,
  files.index,
  files.workLog,
  files.decisionLog,
  files.validationLog,
  files.handoff,
  files.packageJson,
  'scripts/test/run-all-checks.mjs',
  'D7_E3V_ExactPostHocAttributionReadOnlyDiagnostic.js',
  'tests/unit/d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.test.mjs',
  'scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs',
  'docs/phases/D7_E3V_TO_X_EXACT_POST_HOC_ATTRIBUTION_AND_FIRESTORE_RECONCILIATION_DECISION.md'
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

function fail(code) {
  console.error('D7_E3R_EXACT_BOUNDED_PRODUCTION_READ_ONLY_ADAPTERS_CHECK=FAIL');
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

function normalizeStatusPath(value) {
  return String(value || '').trim().replace(/\\/g, '/');
}

function isKnownGuardDirtyPath(file) {
  return knownGuardDirtyFiles.has(file) || knownGuardDirtyPrefixes.some(prefix => file.startsWith(prefix));
}

function parseStatusLine(line) {
  const raw = String(line || '');
  if (!raw.trim()) return null;
  const indexStatus = raw[0] || ' ';
  const worktreeStatus = raw[1] || ' ';
  const file = normalizeStatusPath(raw.slice(3).split(' -> ').pop());
  return {
    file,
    staged: indexStatus !== ' ' && indexStatus !== '?',
    dirty: worktreeStatus !== ' ' || (indexStatus === '?' && worktreeStatus === '?')
  };
}

function assertPhaseFileState() {
  const statusLines = git(['status', '--short']).split(/\r?\n/).filter(Boolean);
  for (const line of statusLines) {
    const entry = parseStatusLine(line);
    if (!entry) continue;
    if (entry.staged) fail(`STAGED_FILE_${entry.file.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
    if (isKnownGuardDirtyPath(entry.file)) continue;
    if (entry.dirty && !phaseFiles.has(entry.file)) fail(`UNAPPROVED_DIRTY_FILE_${entry.file.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }
}

function countFunctionDeclarations(text, name) {
  const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  return [...withoutComments.matchAll(new RegExp(`\\bfunction\\s+${name}\\s*\\(`, 'g'))].length;
}

function runCheck() {
  for (const file of Object.values(files)) {
    if (!exists(file)) fail(`MISSING_FILE_${file.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }

  const adapter = read(files.adapter);
  const forensic = read(files.forensic);
  const unitTest = read(files.test);
  const e3iTest = read(files.e3iTest);
  const docs = read(files.docs);
  const e3iDocs = read(files.e3iDocs);
  const packageJson = read(files.packageJson);
  const manifest = read(files.manifest);

  assertPhaseFileState();

  if (countFunctionDeclarations(adapter, 'createD7E3RExactBoundedProductionReadOnlyAdapters_') !== 1) fail('ADAPTER_FACTORY_DECLARATION_COUNT_NOT_ONE');
  for (const marker of [
    'D7_E3R_READER_IMPLEMENTATION_',
    'REAL_BOUNDED_READ_ONLY',
    'readGmailEvidence',
    'readDriveEvidence',
    'readSheetsEvidence',
    'readFirestoreEvidence',
    'readSnapshot',
    'buildD7E3RContext_',
    'discoverD7E3RExactCandidateReadOnly_',
    'fingerprintD7E3RCandidate_',
    'reconstructD7E3RPlan_',
    'blockedD7E3RResult_'
  ]) {
    assertIncludes(adapter, marker, `ADAPTER_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }

  for (const marker of [
    'productionReaders.readSnapshot',
    'productionReaders.readGmailEvidence',
    'productionReaders.readDriveEvidence',
    'productionReaders.readSheetsEvidence',
    'productionReaders.readFirestoreEvidence',
    'READER_DIAGNOSTICS',
    'PLACEHOLDER_PRODUCTION_PATH_DISABLED',
    'REAL_ADAPTER_INVOCATION_PROVEN',
    'PRODUCTION_PERMISSION_PROBE_EXECUTED'
  ]) {
    assertIncludes(forensic, marker, `FORENSIC_WIRING_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }

  assertMatches(adapter, /gmailSearch\(config\.boundedQuery,\s*0,\s*Math\.min\(2,\s*Number\(config\.maxResults/, 'GMAIL_QUERY_NOT_BOUNDED');
  assertIncludes(adapter, "'subject:' + quoteD7E3RGmailQuery_", 'GMAIL_SUBJECT_QUERY_NOT_EXACT');
  assertIncludes(adapter, 'has:attachment', 'GMAIL_ATTACHMENT_QUERY_MARKER_MISSING');
  assertIncludes(adapter, 'messageCount: 1', 'GMAIL_SINGLE_MESSAGE_CONTRACT_MISSING');
  assertIncludes(adapter, 'xmlAttachments.length !== 1 || candidate.pdfAttachments.length !== 1', 'GMAIL_ATTACHMENT_CARDINALITY_CONTRACT_MISSING');

  assertIncludes(adapter, 'services.driveGetFolderById', 'DRIVE_SERVICE_INJECTION_MISSING');
  assertIncludes(adapter, 'getFilesByName(target.fileName)', 'DRIVE_EXACT_NAME_LOOKUP_MISSING');
  assertNotMatches(adapter, /\.getFiles\s*\(/, 'DRIVE_FOLDER_WIDE_SCAN_PRESENT');
  assertIncludes(adapter, 'D7_E3R_DRIVE_MAX_FILES_PER_ARTIFACT_', 'DRIVE_BOUNDED_DUPLICATE_LIMIT_MISSING');
  assertIncludes(adapter, 'DOCUMENT_IDENTITY_MISMATCH', 'DRIVE_DOCUMENT_IDENTITY_MISMATCH_MISSING');

  assertIncludes(adapter, 'services.openSpreadsheetById', 'SHEETS_SERVICE_INJECTION_MISSING');
  assertIncludes(adapter, 'getRange(rowNumber, 1, 1, width)', 'SHEETS_EXACT_ROW_RANGE_MISSING');
  assertIncludes(adapter, 'const width = 16', 'SHEETS_WIDTH_A_TO_P_MISSING');
  assertNotMatches(adapter, /getDataRange\s*\(/, 'SHEETS_BROAD_SCAN_PRESENT');
  assertIncludes(adapter, 'D7_E3R_SHEET_ROW_NUMBER', 'SHEETS_EXACT_ROW_PROPERTY_MISSING');

  assertIncludes(adapter, 'https://firestore.googleapis.com/v1/projects/', 'FIRESTORE_REST_ENDPOINT_MISSING');
  assertIncludes(adapter, "method: 'get'", 'FIRESTORE_GET_ONLY_MARKER_MISSING');
  assertIncludes(adapter, 'muteHttpExceptions: true', 'FIRESTORE_MUTE_HTTP_EXCEPTIONS_MISSING');
  assertIncludes(adapter, 'D7_E3R_FIRESTORE_MAX_READ_CALLS_', 'FIRESTORE_READ_BOUND_MISSING');
  assertIncludes(adapter, 'validateD7E3RFirestoreDocumentPath_', 'FIRESTORE_PATH_VALIDATOR_MISSING');
  assertIncludes(adapter, 'invoiceJobs', 'FIRESTORE_INVOICE_JOB_ROOT_MISSING');
  assertIncludes(adapter, 'worker_leases', 'FIRESTORE_LEASE_ROOT_MISSING');
  assertIncludes(adapter, 'attachments', 'FIRESTORE_ATTACHMENT_ROOT_MISSING');
  assertIncludes(adapter, 'firestoreRequestPathHashPrefix', 'FIRESTORE_PATH_HASH_DIAGNOSTIC_MISSING');

  for (const forbidden of [
    /\.setProperty\s*\(/,
    /\.deleteProperty\s*\(/,
    /ScriptApp\.newTrigger/,
    /ScriptApp\.deleteTrigger/,
    /\.(addLabel|removeLabel|markRead|markUnread|moveToTrash)\s*\(/,
    /\.(createFile|createFolder|setTrashed|setName|setContent)\s*\(/,
    /\.(appendRow|setValue|setValues|deleteRow|clear)\s*\(/,
    /method:\s*['"`](post|put|patch|delete)['"`]/i,
    /runQuery|listCollection|createDocument|updateDocument|deleteDocument/,
    /clasp\s+(push|deploy|run)/i,
    /firebase\s+deploy/i,
    /gcloud\s+deploy/i
  ]) {
    assertNotMatches(adapter, forbidden, `FORBIDDEN_ADAPTER_PATTERN_${forbidden.toString().replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }

  for (const marker of [
    'D7_E3R_SCENARIOS',
    'D7_E3R_SCENARIOS.length, 54',
    'Firestore 200 decodes job, lease, attachments and report',
    'Firestore 404s are safe absence evidence',
    'Firestore 403 produces sanitized authorization diagnostics',
    'Drive duplicate ambiguity fails closed',
    'Sheet exact row reads row 42 A:P three ways'
  ]) {
    assertIncludes(unitTest, marker, `TEST_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }

  for (const marker of [
    '84. default productionReaders path disables placeholder reader diagnostics when all five channels are real',
    '85. missing productionReaders preserve fail-closed placeholder diagnostics'
  ]) {
    assertIncludes(e3iTest, marker, `E3I_TEST_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }

  for (const marker of [
    'PHASE=D7_E3R_TO_U_EXACT_BOUNDED_PRODUCTION_READ_ONLY_ADAPTER_IMPLEMENTATION_SOURCE_SYNC_AND_FRESH_FORENSIC',
    'MODE=LOCAL_IMPLEMENTATION_SOURCE_SYNC_AND_OWNER_GATED_READ_ONLY_FORENSIC',
    'PRODUCTION_MUTATION=NONE',
    'GMAIL_ADAPTER=REAL_EXACT_BOUNDED_READ_ONLY',
    'DRIVE_ADAPTER=REAL_EXACT_BOUNDED_READ_ONLY',
    'SHEETS_ADAPTER=REAL_EXACT_BOUNDED_READ_ONLY',
    'FIRESTORE_ADAPTER=REAL_EXACT_BOUNDED_READ_ONLY',
    'APPSSCRIPT_SCOPE_CHANGE=NO',
    'FRESH_PRODUCTION_FORENSIC_EXECUTION=OWNER_GATED',
    'NEXT_REQUIRED_OWNER_ACTION=RUN_FRESH_D7_E3I_READ_ONLY_EXACTLY_ONCE'
  ]) {
    assertIncludes(docs, marker, `DOC_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }
  assertIncludes(e3iDocs, 'D7-E3R Exact Bounded Adapters', 'E3I_DOCS_D7_E3R_SECTION_MISSING');

  assertIncludes(packageJson, '"check:d7-e3r-exact-bounded-production-read-only-adapters"', 'PACKAGE_SCRIPT_MISSING');
  for (const scope of [
    'https://mail.google.com/',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/datastore'
  ]) {
    assertIncludes(manifest, scope, `MANIFEST_SCOPE_MISSING_${scope.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }
  assertNotMatches(manifest, /cloud-platform/i, 'CLOUD_PLATFORM_SCOPE_PRESENT');

  console.log('D7_E3R_EXACT_BOUNDED_PRODUCTION_READ_ONLY_ADAPTERS_CHECK=PASS');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCheck();
}
