import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');
const corePath = 'productionReadOnlySnapshotAdapters.js';
const gmailPath = 'gasGmailReadOnlyReader.js';
const drivePath = 'gasDriveReadOnlyReader.js';
const sheetsPath = 'gasSheetsReadOnlyReader.js';
const testPath = 'tests/unit/production-read-only-snapshot-adapters.test.mjs';
const fixturePath = 'fixtures/production-read-only-snapshots/fake-production-read-only-snapshots.mjs';
const docPath = 'docs/phases/SGDS_CRIT_003_D5C_PRODUCTION_READ_ONLY_SNAPSHOT_ADAPTERS.md';

const core = read(corePath);
const gmail = read(gmailPath);
const drive = read(drivePath);
const sheets = read(sheetsPath);
const adapters = { [corePath]: core, [gmailPath]: gmail, [drivePath]: drive, [sheetsPath]: sheets };
const tests = read(testPath);
const fixture = read(fixturePath);
const doc = fs.existsSync(docPath) ? read(docPath) : '';
const packageJson = JSON.parse(read('package.json'));

const requiredCoreMarkers = [
  'function createProductionReadOnlySnapshotAdapters',
  'gmailReader',
  'driveReader',
  'sheetsReader',
  'identityHasher',
  'clock',
  'limits',
  'readGmailLabelSnapshot',
  'readDriveEvidenceSnapshot',
  'readHoaDonSnapshot',
  'readLedgerSnapshot',
  'buildDurableReconciliationSnapshot',
  'MAX_GMAIL_MESSAGES_PER_THREAD',
  'MAX_HOA_DON_ROWS_SCANNED',
  'MAX_LEDGER_ROWS_SCANNED',
  'MAX_DRIVE_DUPLICATE_CANDIDATES',
  'READ_OK',
  'NOT_FOUND',
  'MULTIPLE_MATCHES',
  'READ_LIMIT_EXCEEDED',
  'READ_FAILED',
  'REFERENCE_INVALID',
  'CONTENT_HASH_MISMATCH',
  'sourceReferenceHashPrefix',
  'fileReferenceHashPrefix',
  'snapshotMeta',
  'sanitized: true'
];
for (const marker of requiredCoreMarkers) {
  assert.match(core, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5C core missing marker: ${marker}`);
}

const wrapperMarkers = [
  [gmail, 'GmailApp.getThreadById'],
  [gmail, 'thread.getMessages'],
  [gmail, 'thread.getLabels'],
  [gmail, 'message.getAttachments({ includeInlineImages: false })'],
  [drive, 'DriveApp.getFileById'],
  [drive, 'file.getBlob'],
  [drive, 'file.getMimeType'],
  [drive, 'file.getSize'],
  [drive, 'file.isTrashed'],
  [sheets, 'SpreadsheetApp.openById'],
  [sheets, 'getSheetByName(CONFIG.SHEET_FILES)'],
  [sheets, 'getSheetByName(CONFIG.SHEET_INVOICE)'],
  [sheets, 'getRange'],
  [sheets, 'getValues']
];
for (const [text, marker] of wrapperMarkers) {
  assert.match(text, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5C wrapper missing read marker: ${marker}`);
}

const forbiddenAdapterTokens = [
  'setValue',
  'setValues',
  'appendRow',
  'deleteRow',
  'insertRow',
  'createFile',
  'makeCopy',
  'setName',
  'moveTo',
  'setTrashed',
  'addLabel',
  'removeLabel',
  'sendEmail',
  '.reply('
];
for (const [file, text] of Object.entries(adapters)) {
  for (const token of forbiddenAdapterTokens) {
    assert.equal(text.includes(token), false, `D5C adapter contains forbidden mutation token ${token} in ${file}`);
  }
}

assert.equal(core.includes('GmailApp'), false, 'D5C core must not depend on GmailApp');
assert.equal(core.includes('DriveApp'), false, 'D5C core must not depend on DriveApp');
assert.equal(core.includes('SpreadsheetApp'), false, 'D5C core must not depend on SpreadsheetApp');
assert.equal(core.includes('PropertiesService'), false, 'D5C core must not depend on Script Properties');

const runtimeFiles = ['main.js', 'gmailScanner.js', '_triggerDriveScanner.js', 'gmailProcessInvoiceXML.js', 'durableInvoiceOrchestrator.js', 'durableScannerShadowRunner.js'];
for (const file of runtimeFiles) {
  const text = read(file);
  assert.doesNotMatch(text, /createProductionReadOnlySnapshotAdapters|D5C_PRODUCTION_READ_ONLY_SNAPSHOT_ADAPTERS/, `D5C checker detected runtime wiring in ${file}`);
}

const requiredTestMarkers = [
  'D5C_TEST_SCENARIOS.length, 33',
  'D5C_READ_FAILURE_CASES.length, 9',
  'exact Gmail thread found',
  'Gmail thread not found',
  'Gmail saved label present',
  'Gmail pending label conflict',
  'Gmail message limit exceeded',
  'exact XML and PDF files',
  'missing files',
  'content hash mismatch',
  'duplicate candidates',
  'invalid references',
  'one row, missing row, duplicate rows',
  'one-line, multi-line, missing, extra, blank, inconsistent, and duplicate line states',
  'complete and partial reconciliation snapshots',
  'adapter read failures are sanitized',
  'snapshot ordering is deterministic',
  'input remains immutable',
  'no raw identifiers or invoice PII',
  'zero mutation method calls',
  'zero production network calls'
];
for (const marker of requiredTestMarkers) assert.match(tests, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5C tests missing marker: ${marker}`);

const requiredFixtureMarkers = [
  'D5C_TEST_SCENARIOS',
  'D5C_READ_FAILURE_CASES',
  'createD5CReadOnlyFixtures',
  'gmailReader',
  'driveReader',
  'sheetsReader',
  'mutationTrap',
  'mutationCalls',
  'networkCalls',
  'RAW_GMAIL_THREAD_ID_SHOULD_NOT_LEAK_D5C',
  'RAW_XML_FILE_ID_SHOULD_NOT_LEAK_D5C',
  'RAW_PDF_FILE_ID_SHOULD_NOT_LEAK_D5C'
];
for (const marker of requiredFixtureMarkers) assert.match(fixture, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5C fixture missing marker: ${marker}`);

const requiredDocMarkers = [
  'SGDS_CRIT_003_D5C_STATUS=PASS_PRODUCTION_READ_ONLY_ADAPTERS_LOCAL',
  'D5C_IMPLEMENTATION_STATUS=LOCAL_ONLY',
  'PRODUCTION_COMPATIBLE_READERS=IMPLEMENTED_NOT_EXECUTED',
  'PRODUCTION_READ=NONE',
  'PRODUCTION_WRITE=NONE',
  'PRODUCTION_FIRESTORE_ACCESS=NONE',
  'PUBLIC_GAS_ENTRYPOINT=NONE',
  'SCANNER_RUNTIME_WIRING=NOT_STARTED',
  'MAIN_RUNTIME_WIRING=NOT_STARTED',
  'GAS_PUSH=NOT_RUN',
  'FIREBASE_DEPLOY=NOT_RUN',
  'AUTOMATIC_REPAIR=DISABLED',
  'DEPENDENCY_INJECTION=YES',
  'EXACT_REFERENCE_POLICY=YES',
  'READ_LIMIT_POLICY=YES',
  'SANITIZATION_POLICY=YES',
  'RAW_IDENTIFIER_OUTPUT=NO',
  'RAW_INVOICE_PII_OUTPUT=NO',
  'MUTATION_METHOD_CALL_COUNT=0',
  'TEST_SCENARIO_COUNT=33',
  'READ_FAILURE_CASE_COUNT=9',
  'SGDS_CRIT_003_STATUS=NOT_FIXED',
  'NEXT_ALLOWED_PHASE=SGDS_CRIT_003_D5D_PRODUCTION_READ_ONLY_SHADOW_SMOKE'
];
for (const marker of requiredDocMarkers) assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5C doc missing marker: ${marker}`);

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d5c'],
  'node scripts/checkers/check-sgds-crit-003-d5c-read-only-snapshot-adapters.mjs',
  'package command check:sgds-crit-003-d5c missing or changed'
);

console.log('SGDS_CRIT_003_D5C_CHECK=PASS');
