import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');
const sourcePath = 'durableInvoiceOrchestrator.js';
const testPath = 'tests/unit/durable-invoice-orchestrator.test.mjs';
const fixturePath = 'fixtures/durable-orchestration/fake-durable-orchestration.mjs';
const docPath = 'docs/phases/SGDS_CRIT_003_D5A_LOCAL_DURABLE_ORCHESTRATION.md';

const source = read(sourcePath);
const tests = read(testPath);
const fixture = read(fixturePath);
const doc = fs.existsSync(docPath) ? read(docPath) : '';
const packageJson = JSON.parse(read('package.json'));

const requiredSourceMarkers = [
  'const D5A_LOCAL_ONLY = true',
  'function createDurableInvoiceOrchestrator',
  'executeDurableInvoiceJob',
  'resumeDurableInvoiceJob',
  'sourceAdapter',
  'driveEvidenceAdapter',
  'hoaDonAdapter',
  'ledgerAdapter',
  'gmailProjectionAdapter',
  'jobStore',
  'clock',
  'DRIVE_XML',
  'DRIVE_PDF',
  'HOA_DON',
  'LEDGER',
  'GMAIL',
  'saveCommitPlanIfAbsent',
  'readLabels({ commitPlan, job, stage: \'PRE_LEDGER\' })',
  'runExternalStepD5A_',
  'reconciliationHandoffD5A_',
  'expectedVersion',
  'resumeCompletedJob',
  'RECONCILIATION_REQUIRED_AUTO_RESUME_BLOCKED',
  'appendAuditEvent'
];
for (const marker of requiredSourceMarkers) {
  assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5A source missing marker: ${marker}`);
}

const requiredAdapterMethods = [
  'loadSource',
  'parseInvoice',
  'validateInvoice',
  'buildSourceSnapshot',
  'findEvidence',
  'writeXmlIfAbsent',
  'writePdfIfAbsent',
  'verifyEvidence',
  'findInvoiceRow',
  'writeInvoiceRowIfAbsent',
  'verifyInvoiceRow',
  'findInvoiceLines',
  'appendInvoiceLinesIfAbsent',
  'verifyInvoiceLines',
  'readLabels',
  'applySavedLabel',
  'verifySavedLabel'
];
for (const method of requiredAdapterMethods) assert.match(source, new RegExp(method), `injected adapter method missing: ${method}`);

const statusMarkers = [
  'NOT_ATTEMPTED',
  'CONFIRMED_NOT_WRITTEN',
  'CONFIRMED_WRITTEN',
  'ALREADY_PRESENT',
  'OUTCOME_UNKNOWN',
  'CONFLICT',
  'FAILED'
];
for (const status of statusMarkers) assert.match(source, new RegExp(status), `step result status missing: ${status}`);

const forbiddenSourceTokens = [
  'GmailApp',
  'DriveApp',
  'SpreadsheetApp',
  'PropertiesService',
  'UrlFetchApp',
  'firebaseConfig',
  'apiKey',
  'projectId',
  'triggerScanInvoiceDriveFolder',
  'scanInvoiceOutEmails_',
  'scanInvoiceInEmails_',
  'mainRun',
  'automaticRepair',
  'repairDurable'
];
for (const token of forbiddenSourceTokens) {
  assert.equal(source.includes(token), false, `D5A source contains forbidden production/wiring token: ${token}`);
}

const runtimeFiles = ['main.js', 'gmailScanner.js', '_triggerDriveScanner.js', 'gmailProcessInvoiceXML.js', 'hashUtils.js', 'sheetWriter.js', 'sheetHoaDon.js'];
for (const file of runtimeFiles) {
  const text = read(file);
  assert.doesNotMatch(text, /durableInvoiceOrchestrator|createDurableInvoiceOrchestrator|D5A_LOCAL_DURABLE_ORCHESTRATION/, `D5A checker detected runtime wiring in ${file}`);
}

const requiredTestMarkers = [
  'D5A_TEST_SCENARIOS.length, 26',
  'D5A_FAULT_INJECTION_CASES.length, 10',
  'happy path one-line invoice',
  'happy path multi-line invoice',
  'completed job resume',
  'same source resubmission',
  'Gmail and Drive source snapshots converge',
  'Drive XML existing conflict',
  'Drive XML response lost',
  'Drive PDF write failure',
  'Hoa-Don duplicate conflict',
  'Hoa-Don response lost',
  'partial ledger commit',
  'ledger response lost',
  'ledger verification mismatch',
  'Gmail false saved label',
  'Gmail label write failure',
  'Gmail label response lost',
  'version conflicts before and after external mutation',
  'reconciliation-required job cannot auto-resume',
  'completed job cannot transition backward',
  'two concurrent orchestration attempts',
  'same local scenario run twice is deterministic',
  'inputs remain immutable'
];
for (const marker of requiredTestMarkers) assert.match(tests, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5A tests missing marker: ${marker}`);

const requiredFixtureMarkers = [
  'record calls',
  'mutationLog',
  'FAILED_BEFORE_WRITE',
  'OUTCOME_UNKNOWN_AFTER_WRITE',
  'partialLedgerCommit',
  'driveXmlExisting',
  'drivePdfExisting',
  'hoaDonExisting',
  'ledgerExisting',
  'falseSavedLabelBeforeLedger',
  'savedLabelAlreadyCorrect'
];
for (const marker of requiredFixtureMarkers) assert.match(fixture, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5A fixture missing marker: ${marker}`);

const requiredDocMarkers = [
  'SGDS_CRIT_003_D5A_STATUS=PASS_LOCAL_DURABLE_ORCHESTRATION',
  'D4_GITHUB_PUSH=PASS',
  'ADAPTER_MODE=INJECTED_FAKE',
  'JOB_STORE_MODE=INJECTED_LOCAL',
  'CLOCK_MODE=INJECTED',
  'EXECUTION_ORDER=DRIVE_XML_DRIVE_PDF_HOA_DON_LEDGER_GMAIL',
  'COMMIT_PLAN_BEFORE_MUTATION=YES',
  'READ_BEFORE_WRITE=YES',
  'SAVED_LABEL_LAST=YES',
  'UNKNOWN_OUTCOME_POLICY=RECONCILIATION_REQUIRED',
  'CONFLICT_POLICY=RECONCILIATION_REQUIRED',
  'PARTIAL_LEDGER_POLICY=RECONCILIATION_REQUIRED_NO_AUTO_APPEND',
  'COMPLETED_RESUME_IDEMPOTENT=YES',
  'RECONCILIATION_REQUIRED_AUTO_RESUME=BLOCKED',
  'EXPECTED_VERSION_REQUIRED=YES',
  'AUDIT_APPEND_ONLY=YES',
  'TEST_SCENARIO_COUNT=26',
  'FAULT_INJECTION_CASE_COUNT=10',
  'EXTERNAL_API_CALL=NO',
  'PRODUCTION_FIRESTORE_ACCESS=NONE',
  'SCANNER_RUNTIME_WIRING=NOT_STARTED',
  'MAIN_RUNTIME_WIRING=NOT_STARTED',
  'AUTOMATIC_REPAIR=DISABLED',
  'SGDS_CRIT_003_STATUS=NOT_FIXED',
  'NEXT_ALLOWED_PHASE=SGDS_CRIT_003_D5B_SHADOW_MODE_DESIGN_OR_LOCAL_ADAPTERS'
];
for (const marker of requiredDocMarkers) assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5A doc missing marker: ${marker}`);

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d5a'],
  'node scripts/checkers/check-sgds-crit-003-d5a-local-orchestration.mjs',
  'package command check:sgds-crit-003-d5a missing or changed'
);

console.log('SGDS_CRIT_003_D5A_CHECK=PASS');
