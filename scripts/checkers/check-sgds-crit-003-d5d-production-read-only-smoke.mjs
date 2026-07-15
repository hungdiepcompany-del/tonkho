import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');
const sourcePath = 'sgdsCrit003D5dReadOnlySmoke.js';
const adapterPath = 'productionReadOnlySnapshotAdapters.js';
const sheetsReaderPath = 'gasSheetsReadOnlyReader.js';
const testPath = 'tests/unit/sgds-crit-003-d5d-read-only-smoke.test.mjs';
const docPath = 'docs/phases/SGDS_CRIT_003_D5D_PRODUCTION_READ_ONLY_SHADOW_SMOKE.md';

const source = read(sourcePath);
const adapters = read(adapterPath);
const sheetsReader = read(sheetsReaderPath);
const tests = read(testPath);
const doc = fs.existsSync(docPath) ? read(docPath) : '';
const packageJson = JSON.parse(read('package.json'));

const requiredSourceMarkers = [
  'const SGDS_CRIT_003_D5D_MODE_ = \'EXACT_REFERENCE_PRODUCTION_READ_ONLY\'',
  'SGDS_D5D_GMAIL_THREAD_ID',
  'SGDS_D5D_XML_FILE_ID',
  'SGDS_D5D_PDF_FILE_ID',
  'SGDS_D5D_INVOICE_IDENTITY_HASH',
  'SGDS_D5D_EXPECTED_LINE_COUNT',
  'SGDS_D5D_EXPECTED_LINE_HASHES_JSON',
  'SGDS_D5D_EXPECTED_INVOICE_KEY_HASH',
  'SGDS_D5D_EXPECTED_COMMIT_PLAN_HASH',
  'async function runSgdsCrit003D5dProductionReadOnlyShadowSmoke()',
  'PropertiesService.getScriptProperties',
  'props.getProperty(key)',
  'function createSgdsCrit003D5dReadOnlySmokeExecutor',
  'BLOCKED_EXACT_REFERENCE_CONFIG_MISSING',
  'PRODUCTION_API_READ_STARTED',
  'collectD5DReadOnlySnapshot_',
  'readGmailLabelSnapshot',
  'readDriveEvidenceSnapshot',
  'readHoaDonSnapshot',
  'readLedgerSnapshot',
  'buildDurableReconciliationSnapshot',
  'reconcileDurableInvoiceJobReportOnly',
  'adaptD5DReconciliationSnapshot_',
  'BEFORE_AFTER_SNAPSHOT_MATCH',
  'MUTATION_ATTEMPT_COUNT',
  'PRODUCTION_WRITE: \'NONE\'',
  'SGDS_CRIT_003_D5D_SMOKE_START=YES',
  'SMOKE_MODE=PRODUCTION_READ_ONLY',
  'EXACT_REFERENCE_POLICY=YES'
];
for (const marker of requiredSourceMarkers) {
  assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5D source missing marker: ${marker}`);
}

const forbiddenSourceTokens = [
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
  '.reply(',
  'setProperty',
  'setProperties',
  'deleteProperty',
  'deleteAllProperties',
  'UrlFetchApp',
  'Firestore',
  'firebaseConfig',
  'createDurableInvoiceOrchestrator',
  'createDurableScannerShadowRunner',
  'mainRun',
  'triggerScanInvoiceDriveFolder'
];
for (const token of forbiddenSourceTokens) {
  assert.equal(source.includes(token), false, `D5D source contains forbidden mutation/wiring token: ${token}`);
}

assert.match(adapters, /xmlFileReference: driveReferencesD5C_\(request\)\.xml/, 'D5D requires Hoa-Don exact XML reference passthrough');
assert.match(adapters, /pdfFileReference: driveReferencesD5C_\(request\)\.pdf/, 'D5D requires Hoa-Don exact PDF reference passthrough');
assert.match(sheetsReader, /xmlFileReference/, 'D5D requires GAS sheet reader XML reference matching');
assert.match(sheetsReader, /pdfFileReference/, 'D5D requires GAS sheet reader PDF reference matching');
assert.match(sheetsReader, /legacyInvoiceKey/, 'D5D requires legacy invoice key preservation in read-only rows');

const runtimeFiles = ['main.js', 'gmailScanner.js', '_triggerDriveScanner.js', 'gmailProcessInvoiceXML.js', 'durableInvoiceOrchestrator.js', 'durableScannerShadowRunner.js'];
for (const file of runtimeFiles) {
  const text = read(file);
  assert.doesNotMatch(text, /runSgdsCrit003D5dProductionReadOnlyShadowSmoke|createSgdsCrit003D5dReadOnlySmokeExecutor|SGDS_CRIT_003_D5D/, `D5D checker detected runtime wiring in ${file}`);
}

const requiredTestMarkers = [
  'D5D_TEST_SCENARIOS.length, 19',
  'all exact references present',
  'one reference missing',
  'invalid expected line count',
  'invalid expected hashes JSON',
  'duplicate Drive evidence detected',
  'duplicate Hoa-Don row detected',
  'duplicate ledger line detected',
  'saved-label mismatch detected',
  'before/after snapshot unchanged',
  'concurrent external change detected',
  'reader exception sanitized',
  'raw IDs absent from logs',
  'PII absent from logs',
  'zero mutation calls',
  'zero Firestore writes',
  'BLOCKED_EXACT_REFERENCE_CONFIG_MISSING',
  'PASS_PRODUCTION_READ_ONLY_CONSISTENT',
  'PASS_READ_ONLY_FINDINGS_DETECTED',
  'REVIEW_REQUIRED_CONCURRENT_EXTERNAL_CHANGE'
];
for (const marker of requiredTestMarkers) assert.match(tests, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5D tests missing marker: ${marker}`);

const requiredDocMarkers = [
  'SGDS_CRIT_003_D5D_STATUS=PASS_LOCAL_EXACT_REFERENCE_READ_ONLY_SMOKE_READY',
  'D5D_MODE=EXACT_REFERENCE_PRODUCTION_READ_ONLY',
  'PRODUCTION_READ_SCOPE=ONE_KNOWN_INVOICE',
  'EXACT_REFERENCE_CONFIG=SCRIPT_PROPERTIES_REQUIRED_AT_RUNTIME',
  'SMOKE_FUNCTION=runSgdsCrit003D5dProductionReadOnlyShadowSmoke',
  'PUBLIC_GAS_ENTRYPOINT=TEMPORARY_READ_ONLY_SMOKE_FUNCTION',
  'PRODUCTION_WRITE=NONE',
  'PRODUCTION_FIRESTORE_ACCESS=NONE',
  'FIRESTORE_ACCESS=NONE',
  'SCANNER_RUNTIME_WIRING=NOT_STARTED',
  'MAIN_RUNTIME_WIRING=NOT_STARTED',
  'TRIGGER_CREATED=NO',
  'MENU_CREATED=NO',
  'AUTOMATIC_REPAIR=DISABLED',
  'BATCH_ACTIVATION=NOT_APPROVED',
  'MUTATION_ATTEMPT_COUNT=0',
  'RAW_IDENTIFIER_OUTPUT=NO',
  'RAW_INVOICE_PII_OUTPUT=NO',
  'TEST_SCENARIO_COUNT=19',
  'SGDS_CRIT_003_STATUS=NOT_FIXED',
  'NEXT_ALLOWED_PHASE=GAS_SOURCE_PUSH_AND_OWNER_MANUAL_D5D_READ_ONLY_SMOKE'
];
for (const marker of requiredDocMarkers) assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5D doc missing marker: ${marker}`);

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d5d'],
  'node scripts/checkers/check-sgds-crit-003-d5d-production-read-only-smoke.mjs',
  'package command check:sgds-crit-003-d5d missing or changed'
);

console.log('SGDS_CRIT_003_D5D_CHECK=PASS');
