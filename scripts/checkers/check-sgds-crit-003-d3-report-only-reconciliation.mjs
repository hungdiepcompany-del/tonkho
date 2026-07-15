import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');

const runtime = read('durableReconciliation.js');
const tests = read('tests/unit/durable-reconciliation.test.mjs');
const fixtures = read('fixtures/sgds-crit-003-d3/reconciliation-fixtures.mjs');
const packageJson = JSON.parse(read('package.json'));

const requiredCodes = [
  'JOB_MISSING',
  'COMMIT_PLAN_MISSING',
  'COMMIT_PLAN_HASH_MISMATCH',
  'COMMIT_PLAN_VERSION_MISMATCH',
  'STATE_AHEAD_OF_EVIDENCE',
  'STATE_BEHIND_EVIDENCE',
  'TERMINAL_STATE_CONFLICT',
  'DRIVE_XML_MISSING',
  'DRIVE_PDF_MISSING',
  'DRIVE_ARTIFACT_DUPLICATE',
  'DRIVE_CONTENT_HASH_MISMATCH',
  'HOA_DON_ROW_MISSING',
  'HOA_DON_ROW_DUPLICATE',
  'HOA_DON_FILE_REFERENCE_MISMATCH',
  'LEDGER_ROWS_MISSING',
  'LEDGER_ROWS_EXTRA',
  'LEDGER_LINE_HASH_MISMATCH',
  'LEDGER_INVOICE_KEY_MISMATCH',
  'LEDGER_DUPLICATE_LINE_IDENTITY',
  'GMAIL_FALSE_SAVED_LABEL',
  'GMAIL_SAVED_LABEL_MISSING',
  'GMAIL_PENDING_LABEL_CONFLICT'
];

const fixtureNames = [
  'allSystemsConsistent',
  'driveSavedHoaDonMissing',
  'hoaDonExistsLedgerMissing',
  'partialLedgerLineCommit',
  'extraLedgerLine',
  'wrongLineHash',
  'wrongInvoiceKey',
  'savedGmailLabelBeforeLedgerCommit',
  'ledgerCommittedSavedLabelMissing',
  'duplicateDriveXml',
  'duplicateHoaDonRow',
  'jobCompletedEvidenceIncomplete',
  'jobBehindObservedEvidence',
  'commitPlanHashMismatch',
  'terminalStateConflict',
  'multiLineInvoiceValid',
  'sameInputReconciledTwice'
];

assert.match(runtime, /function reconcileDurableInvoiceJobReportOnly\(input\)/, 'report-only entrypoint missing');
assert.match(runtime, /DURABLE_RECONCILIATION_FINDING_CODES_/, 'finding code vocabulary missing');
assert.match(runtime, /repairPolicy/, 'finding repairPolicy field missing');
assert.match(runtime, /REPORT_ONLY/, 'REPORT_ONLY policy missing');
assert.match(runtime, /OWNER_REVIEW_REQUIRED/, 'OWNER_REVIEW_REQUIRED policy missing');

for (const code of requiredCodes) {
  assert.match(runtime, new RegExp(`['"]${code}['"]`), `required finding code missing from runtime: ${code}`);
  assert.match(tests, new RegExp(`['"]${code}['"]`), `required finding code missing from tests: ${code}`);
}

for (const fixtureName of fixtureNames) {
  assert.match(fixtures, new RegExp(`['"]${fixtureName}['"]`), `required D3 fixture missing: ${fixtureName}`);
}

for (const forbidden of ['GmailApp', 'DriveApp', 'SpreadsheetApp', 'Firestore', 'UrlFetchApp', 'PropertiesService']) {
  assert.doesNotMatch(runtime, new RegExp(`\\b${forbidden}\\b`), `runtime references forbidden API: ${forbidden}`);
}

assert.doesNotMatch(runtime, /function\s+(repair|fix|apply|commit|delete|updateProduction)\w*\s*\(/i, 'runtime exposes a forbidden mutation function name');
assert.doesNotMatch(runtime, /(\.setValue\(|\.setValues\(|\.appendRow\(|\.deleteRow\(|\.setProperty\(|\.deleteProperty\(|\.addLabel\(|\.removeLabel\()/, 'runtime contains a direct mutation call');

const productionFiles = [
  'main.js',
  'gmailScanner.js',
  '_triggerDriveScanner.js',
  'onOpen.js',
  'Code.js'
].filter(file => fs.existsSync(file));
for (const file of productionFiles) {
  assert.doesNotMatch(read(file), /reconcileDurableInvoiceJobReportOnly/, `D3 reconciler is wired into production file: ${file}`);
}

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d3'],
  'node scripts/checkers/check-sgds-crit-003-d3-report-only-reconciliation.mjs',
  'package command check:sgds-crit-003-d3 missing or changed'
);

assert.match(tests, /same input reconciled twice/i, 'determinism test missing');
assert.match(tests, /input mutated/, 'input mutation test missing');
assert.match(tests, /commit plan/i, 'commit plan mutation regression missing');
assert.match(tests, /DURABLE_JOB_INVALID_TRANSITION/, 'D1 illegal transition regression missing');
assert.match(tests, /IDEMPOTENT_COMPLETE_NOOP/, 'D1 completed resume regression missing');
assert.match(tests, /DURABLE_COMMIT_PLAN_IMMUTABLE/, 'D1 immutable plan regression missing');

console.log('SGDS_CRIT_003_D3_CHECK=PASS');