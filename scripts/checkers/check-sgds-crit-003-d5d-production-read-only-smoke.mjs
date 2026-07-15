import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');
const sourcePath = 'sgdsCrit003D5dReadOnlySmoke.js';
const adapterPath = 'productionReadOnlySnapshotAdapters.js';
const sheetsReaderPath = 'gasSheetsReadOnlyReader.js';
const gmailReaderPath = 'gasGmailReadOnlyReader.js';
const testPath = 'tests/unit/sgds-crit-003-d5d-read-only-smoke.test.mjs';
const docPath = 'docs/phases/SGDS_CRIT_003_D5D_PRODUCTION_READ_ONLY_SHADOW_SMOKE.md';

const source = read(sourcePath);
const adapters = read(adapterPath);
const sheetsReader = read(sheetsReaderPath);
const gmailReader = read(gmailReaderPath);
const tests = read(testPath);
const doc = fs.existsSync(docPath) ? read(docPath) : '';
const packageJson = JSON.parse(read('package.json'));

const requiredSourceMarkers = [
  'const SGDS_CRIT_003_D5D_MODE_ = \'EXACT_THREAD_PRODUCTION_READ_ONLY\'',
  'SGDS_CRIT_003_D5D_REQUIRED_PROPERTY_KEYS_',
  'GMAIL_THREAD_ID: \'SGDS_D5D_GMAIL_THREAD_ID\'',
  'SGDS_CRIT_003_D5D_DERIVED_PROPERTY_KEYS_',
  'SGDS_D5D_XML_FILE_ID',
  'SGDS_D5D_PDF_FILE_ID',
  'SGDS_D5D_INVOICE_IDENTITY_HASH',
  'SGDS_D5D_EXPECTED_LINE_COUNT',
  'SGDS_D5D_EXPECTED_LINE_HASHES_JSON',
  'SGDS_D5D_EXPECTED_INVOICE_KEY_HASH',
  'SGDS_D5D_EXPECTED_COMMIT_PLAN_HASH',
  'async function runSgdsCrit003D5dProductionReadOnlyShadowSmoke()',
  'async function inspectSgdsCrit003D5dExactThreadReadOnly()',
  'PropertiesService.getScriptProperties',
  'props.getProperty(key)',
  'REQUIRED_PROPERTY_COUNT=1',
  'REQUIRED_PROPERTY_NAMES=SGDS_D5D_GMAIL_THREAD_ID',
  'DERIVED_PROPERTY_COUNT=7',
  'BLOCKED_EXACT_THREAD_ID_MISSING',
  'deriveD5DReadOnlyInput_',
  'createSgdsCrit003D5dRuntimeInvoiceDeriver_',
  'parseInvoiceXML_',
  'buildInvoiceKey_',
  'buildInvoiceItemHash_',
  'invoiceIdentityHash',
  'expectedLineCount',
  'commitPlanSeed.commitPlanHash',
  'readGmailLabelSnapshot',
  'readDriveEvidenceSnapshot',
  'readHoaDonSnapshot',
  'readLedgerSnapshot',
  'buildDurableReconciliationSnapshot',
  'reconcileDurableInvoiceJobReportOnly',
  'BEFORE_AFTER_SNAPSHOT_MATCH',
  'MUTATION_ATTEMPT_COUNT',
  'PRODUCTION_WRITE: \'NONE\'',
  'PRODUCTION_FIRESTORE_ACCESS: \'NONE\'',
  'SMOKE_MODE=EXACT_THREAD_PRODUCTION_READ_ONLY',
  'EXACT_REFERENCE_POLICY=YES'
];
for (const marker of requiredSourceMarkers) {
  assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5D-R source missing marker: ${marker}`);
}

assert.match(source, /propertyReader\.getProperty\(SGDS_CRIT_003_D5D_REQUIRED_PROPERTY_KEYS_\.GMAIL_THREAD_ID\)/, 'D5D-R must read only the Gmail thread property');
assert.doesNotMatch(source, /propertyReader\.getProperty\([^)]*XML_FILE_ID|propertyReader\.getProperty\([^)]*PDF_FILE_ID|propertyReader\.getProperty\([^)]*EXPECTED_LINE/i, 'D5D-R derived values must not be Script Property requirements');

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
  'FirestoreApp',
  'getFirestore',
  'createDurableInvoiceJobStore',
  'firebaseConfig',
  'createDurableInvoiceOrchestrator',
  'createDurableScannerShadowRunner',
  'mainRun',
  'triggerScanInvoiceDriveFolder'
];
for (const token of forbiddenSourceTokens) {
  assert.equal(source.includes(token), false, `D5D-R source contains forbidden mutation/wiring token: ${token}`);
}

assert.match(gmailReader, /readThreadEvidence/, 'D5D-R requires exact thread evidence reader');
assert.match(gmailReader, /xmlAttachments/, 'D5D-R requires XML attachment extraction');
assert.match(gmailReader, /pdfSource/, 'D5D-R requires PDF attachment/link-only classification');
assert.match(adapters, /xmlFileReference: driveReferencesD5C_\(request\)\.xml/, 'D5D-R requires Hoa-Don exact XML reference passthrough');
assert.match(adapters, /pdfFileReference: driveReferencesD5C_\(request\)\.pdf/, 'D5D-R requires Hoa-Don exact PDF reference passthrough');
assert.match(sheetsReader, /scanSheetRowsD5D_/, 'D5D-R sheet reader must scan chunks across used range');
assert.match(sheetsReader, /chunkRows/, 'D5D-R sheet reader must support chunked reads');
assert.match(sheetsReader, /maxUsedRows/, 'D5D-R sheet reader must enforce safety ceiling');
assert.match(sheetsReader, /lastRow = sheet\.getLastRow\(\)/, 'D5D-R sheet reader must not cap lastRow to maxRows');
assert.doesNotMatch(sheetsReader, /Math\.min\(sheet\.getLastRow\(\), maxRows \+ 1\)/, 'D5D-R must not only read first 20/50 rows');

const runtimeFiles = ['main.js', 'gmailScanner.js', '_triggerDriveScanner.js', 'gmailProcessInvoiceXML.js', 'durableInvoiceOrchestrator.js', 'durableScannerShadowRunner.js'];
for (const file of runtimeFiles) {
  const text = read(file);
  assert.doesNotMatch(text, /runSgdsCrit003D5dProductionReadOnlyShadowSmoke|createSgdsCrit003D5dReadOnlySmokeExecutor|SGDS_CRIT_003_D5D/, `D5D-R checker detected runtime wiring in ${file}`);
}

const requiredTestMarkers = [
  'D5D_TEST_SCENARIOS.length, 33',
  'only Gmail thread ID required',
  'old seven derived properties not required',
  'thread missing blocks before reads',
  'XML parsed into expected line count',
  'InvoiceKey derived automatically',
  'line hashes derived automatically',
  'Hoa-Don XML/PDF IDs resolved automatically',
  'invoice identity hash derived automatically',
  'invoice key hash derived automatically',
  'commit plan hash derived automatically',
  'Hoa-Don row after row 20 is found',
  'Nhap-Xuat rows after row 50 are found',
  'chunked sheet read finds exact rows',
  'sheet safety ceiling produces READ_LIMIT_EXCEEDED',
  'PDF link-only result',
  'raw identifiers absent from logs',
  'PII absent from logs',
  'mutation calls zero',
  'Firestore writes zero',
  'same run twice deterministic',
  'BLOCKED_EXACT_THREAD_ID_MISSING',
  'PASS_PRODUCTION_READ_ONLY_CONSISTENT',
  'PDF_EXTERNAL_ACQUISITION_REQUIRED'
];
for (const marker of requiredTestMarkers) assert.match(tests, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5D-R tests missing marker: ${marker}`);

const requiredDocMarkers = [
  'SGDS_CRIT_003_D5D_R_STATUS=PASS_SIMPLIFIED_EXACT_THREAD_READ_ONLY_SMOKE_LOCAL',
  'REQUIRED_PROPERTY_COUNT=1',
  'REQUIRED_PROPERTY_NAMES=SGDS_D5D_GMAIL_THREAD_ID',
  'DERIVED_PROPERTY_COUNT=7',
  'OLD_DERIVED_PROPERTIES_REQUIRED=NO',
  'OLD_DERIVED_PROPERTIES_IGNORED_IF_PRESENT=YES',
  'D5D_MODE=EXACT_THREAD_PRODUCTION_READ_ONLY',
  'PRODUCTION_READ_SCOPE=ONE_KNOWN_GMAIL_THREAD',
  'SMOKE_FUNCTION=runSgdsCrit003D5dProductionReadOnlyShadowSmoke',
  'INSPECT_FUNCTION=inspectSgdsCrit003D5dExactThreadReadOnly',
  'INVOICE_KEY_DERIVED=YES',
  'INVOICE_IDENTITY_HASH_DERIVED=YES',
  'EXPECTED_LINE_COUNT_DERIVED=YES',
  'EXPECTED_LINE_HASHES_DERIVED=YES',
  'XML_FILE_ID_AUTO_RESOLVED=YES',
  'PDF_FILE_ID_AUTO_RESOLVED=YES',
  'INVOICE_KEY_HASH_DERIVED=YES',
  'COMMIT_PLAN_HASH_DERIVED=YES',
  'HOA_DON_FULL_USED_RANGE_SEARCH=YES',
  'LEDGER_FULL_USED_RANGE_SEARCH=YES',
  'CHUNKED_READ=YES',
  'FIRST_20_50_ROW_LIMIT_REMOVED=YES',
  'PRODUCTION_WRITE=NONE',
  'PRODUCTION_FIRESTORE_ACCESS=NONE',
  'SCANNER_RUNTIME_WIRING=NOT_STARTED',
  'MAIN_RUNTIME_WIRING=NOT_STARTED',
  'MUTATION_ATTEMPT_COUNT=0',
  'SGDS_CRIT_003_STATUS=NOT_FIXED'
];
for (const marker of requiredDocMarkers) assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5D-R doc missing marker: ${marker}`);

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d5d'],
  'node scripts/checkers/check-sgds-crit-003-d5d-production-read-only-smoke.mjs',
  'package command check:sgds-crit-003-d5d missing or changed'
);

console.log('SGDS_CRIT_003_D5D_CHECK=PASS');
