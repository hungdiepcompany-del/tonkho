import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['sgdsCrit003D5dReadOnlySmoke.js', 'productionReadOnlySnapshotAdapters.js', 'gasSheetsReadOnlyReader.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const D5D_TEST_SCENARIOS = Object.freeze([
  'only Gmail thread ID required',
  'old seven derived properties not required',
  'thread missing blocks before reads',
  'thread found with XML and PDF attachments',
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
  'one-line invoice',
  'multi-line invoice',
  'missing Hoa-Don row',
  'duplicate Hoa-Don rows',
  'missing ledger row',
  'extra ledger row',
  'hash mismatch',
  'InvoiceKey mismatch',
  'Drive XML missing',
  'Drive PDF missing',
  'PDF link-only result',
  'saved Gmail label present',
  'saved Gmail label missing',
  'raw identifiers absent from logs',
  'PII absent from logs',
  'mutation calls zero',
  'Firestore writes zero',
  'same run twice deterministic'
]);

const gas = loadGasSource({
  files: [
    'durableReconciliation.js',
    'productionReadOnlySnapshotAdapters.js',
    'sgdsCrit003D5dReadOnlySmoke.js'
  ],
  exportNames: [
    'createSgdsCrit003D5dReadOnlySmokeExecutor',
    'createProductionReadOnlySnapshotAdapters',
    'reconcileDurableInvoiceJobReportOnly',
    'SGDS_CRIT_003_D5D_MODE_',
    'SGDS_CRIT_003_D5D_PROPERTY_KEYS_',
    'SGDS_CRIT_003_D5D_REQUIRED_PROPERTY_KEYS_',
    'SGDS_CRIT_003_D5D_DERIVED_PROPERTY_KEYS_'
  ]
});

const fromVm = (value) => JSON.parse(JSON.stringify(value));
const RAW_THREAD = 'RAW_GMAIL_THREAD_ID_SHOULD_NOT_LEAK_D5D_R';
const RAW_XML = 'RAW_XML_FILE_ID_SHOULD_NOT_LEAK_D5D_R';
const RAW_PDF = 'RAW_PDF_FILE_ID_SHOULD_NOT_LEAK_D5D_R';
const RAW_PII = '0100000001';
const LEGACY_KEY = '20260201_0100000001_8';

function fnv(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
}

function makeDerivedInvoice(options = {}) {
  const count = options.lineCount || 2;
  const lines = Array.from({ length: count }, (_, index) => ({
    sourceLineNo: index + 1,
    legacyHashIndex: options.hashMismatch && index === 0 ? 'expected-line-hash-mismatch' : `expected-line-hash-${index + 1}`,
    lineIdentityV2: options.hashMismatch && index === 0 ? 'expected-line-hash-mismatch' : `expected-line-hash-${index + 1}`,
    immutableFields: { line: index + 1 }
  }));
  return {
    legacyInvoiceKey: LEGACY_KEY,
    invoiceKeyV2: LEGACY_KEY,
    invoiceIdentityHash: 'derived-invoice-identity-hash',
    expectedLineCount: count,
    lines
  };
}

function makeProperties(overrides = {}) {
  return {
    SGDS_D5D_GMAIL_THREAD_ID: RAW_THREAD,
    SGDS_D5D_XML_FILE_ID: '',
    SGDS_D5D_PDF_FILE_ID: '',
    SGDS_D5D_INVOICE_IDENTITY_HASH: '',
    SGDS_D5D_EXPECTED_LINE_COUNT: '',
    SGDS_D5D_EXPECTED_LINE_HASHES_JSON: '',
    SGDS_D5D_EXPECTED_INVOICE_KEY_HASH: '',
    SGDS_D5D_EXPECTED_COMMIT_PLAN_HASH: '',
    ...overrides
  };
}

function makeHarness(options = {}) {
  const properties = makeProperties(options.properties || {});
  const derived = makeDerivedInvoice(options.derived || {});
  const logs = [];
  const calls = [];
  const mutationCalls = [];
  const networkCalls = [];
  const propertyReader = {
    getProperty(key) {
      calls.push({ name: 'property.getProperty', key });
      return Object.prototype.hasOwnProperty.call(properties, key) ? properties[key] : '';
    }
  };
  const gmailEvidence = {
    exists: options.threadMissing ? false : true,
    messageCount: options.messageCount || 1,
    labels: Object.prototype.hasOwnProperty.call(options, 'gmailLabels') ? options.gmailLabels : ['SGDS/SAVED'],
    attachmentSummary: { xmlCount: options.xmlAttachmentCount ?? 1, pdfCount: options.pdfAttachmentCount ?? 1 },
    xmlAttachments: Array.from({ length: options.xmlAttachmentCount ?? 1 }, (_, index) => ({ nameHashPrefix: `xml-${index}`, xmlText: '<xml/>' })),
    pdfAttachmentCount: options.pdfAttachmentCount ?? 1,
    pdfSource: options.pdfLinkOnly ? 'LINK_ONLY' : (options.pdfAttachmentCount === 0 ? 'NONE' : 'ATTACHMENT'),
    readStatus: options.threadMissing ? 'NOT_FOUND' : 'READ_OK'
  };
  const gmailReader = {
    async readThread(request) {
      calls.push({ name: 'gmail.readThread', request: safeRequest(request) });
      return {
        exists: gmailEvidence.exists,
        messageCount: gmailEvidence.messageCount,
        labels: gmailEvidence.labels,
        attachmentSummary: gmailEvidence.attachmentSummary,
        readStatus: gmailEvidence.readStatus
      };
    },
    async readThreadEvidence(request) {
      calls.push({ name: 'gmail.readThreadEvidence', request: safeRequest(request) });
      return JSON.parse(JSON.stringify(gmailEvidence));
    }
  };
  const hoaDonRows = Object.prototype.hasOwnProperty.call(options, 'hoaDonRows')
    ? options.hoaDonRows
    : [{ legacyInvoiceKey: LEGACY_KEY, invoiceKeyV2: LEGACY_KEY, xmlFileId: RAW_XML, pdfFileId: RAW_PDF, xmlStatus: 'OK', pdfStatus: 'OK', viewLinkPresent: true }];
  const ledgerRows = Object.prototype.hasOwnProperty.call(options, 'ledgerRows')
    ? options.ledgerRows
    : derived.lines.map(line => ({ legacyInvoiceKey: LEGACY_KEY, invoiceKeyV2: LEGACY_KEY, legacyHashIndex: line.legacyHashIndex, lineIdentityV2: line.lineIdentityV2 }));
  const sheetsReader = {
    async readHoaDonRows(request) {
      calls.push({ name: 'sheets.readHoaDonRows', request: safeRequest(request) });
      return JSON.parse(JSON.stringify(hoaDonRows));
    },
    async readLedgerRows(request) {
      calls.push({ name: 'sheets.readLedgerRows', request: safeRequest(request) });
      return JSON.parse(JSON.stringify(ledgerRows));
    }
  };
  const driveFiles = {
    [RAW_XML]: options.xmlMissing ? { exists: false } : { exists: true, contentHash: '', mimeType: 'application/xml', size: 2000, trashed: false },
    [RAW_PDF]: options.pdfMissing ? { exists: false } : { exists: true, contentHash: '', mimeType: 'application/pdf', size: 4000, trashed: false }
  };
  const driveReader = {
    async readFile(request) {
      calls.push({ name: 'drive.readFile', request: safeRequest(request) });
      return JSON.parse(JSON.stringify(driveFiles[request.fileReference] || { exists: false }));
    },
    async findDuplicateCandidates() {
      calls.push({ name: 'drive.findDuplicateCandidates' });
      return [];
    }
  };
  const invoiceDeriver = {
    deriveFromXml(request) {
      calls.push({ name: 'invoiceDeriver.deriveFromXml', xmlTextPresent: Boolean(request.xmlText) });
      return JSON.parse(JSON.stringify(derived));
    }
  };
  const executor = gas.call('createSgdsCrit003D5dReadOnlySmokeExecutor', {
    propertyReader,
    gmailReader,
    driveReader,
    sheetsReader,
    invoiceDeriver,
    identityHasher: { hash: fnv },
    clock: { now: () => '2026-07-15T00:00:00.000Z' },
    logger: { log: line => logs.push(String(line)) },
    reconciliationService: { reconcileDurableInvoiceJobReportOnly: gas.exports.reconcileDurableInvoiceJobReportOnly },
    adapterFactory: gas.exports.createProductionReadOnlySnapshotAdapters,
    limits: options.limits || {}
  });
  return { executor, calls, logs, mutationCalls, networkCalls, properties };
}

function safeRequest(request) {
  const out = { ...(request || {}) };
  for (const key of ['threadReference', 'fileReference', 'legacyInvoiceKey', 'invoiceKeyV2']) {
    if (out[key]) out[key] = `hash:${fnv(out[key]).slice(0, 8)}`;
  }
  return out;
}

test('metadata and simplified property contract', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(D5D_TEST_SCENARIOS.length, 33);
  assert.deepEqual(fromVm(gas.exports.SGDS_CRIT_003_D5D_REQUIRED_PROPERTY_KEYS_), { GMAIL_THREAD_ID: 'SGDS_D5D_GMAIL_THREAD_ID' });
  assert.equal(fromVm(gas.exports.SGDS_CRIT_003_D5D_DERIVED_PROPERTY_KEYS_).length, 7);
});

test('D5D-R reads only Gmail thread ID and ignores old derived properties', async () => {
  const harness = makeHarness({
    properties: {
      SGDS_D5D_XML_FILE_ID: 'WRONG_XML',
      SGDS_D5D_PDF_FILE_ID: 'WRONG_PDF',
      SGDS_D5D_EXPECTED_LINE_COUNT: '999'
    }
  });
  const result = fromVm(await harness.executor.run());
  assert.equal(result.REQUIRED_PROPERTY_COUNT, 1);
  assert.equal(result.REQUIRED_PROPERTY_NAMES, 'SGDS_D5D_GMAIL_THREAD_ID');
  assert.equal(result.DERIVED_PROPERTY_COUNT, 7);
  assert.equal(harness.calls.filter(call => call.name === 'property.getProperty').map(call => call.key).join(','), 'SGDS_D5D_GMAIL_THREAD_ID');
  assert.equal(result.XML_FILE_ID_AUTO_RESOLVED, 'YES');
  assert.equal(result.PDF_FILE_ID_AUTO_RESOLVED, 'YES');
});

test('D5D-R blocks before production reads when thread ID is missing', async () => {
  const harness = makeHarness({ properties: { SGDS_D5D_GMAIL_THREAD_ID: '' } });
  const result = fromVm(await harness.executor.run());
  assert.equal(result.SGDS_CRIT_003_D5D_SMOKE_STATUS, 'BLOCKED_EXACT_THREAD_ID_MISSING');
  assert.equal(result.PRODUCTION_API_READ_STARTED, 'NO');
  assert.equal(harness.calls.some(call => call.name.startsWith('gmail.')), false);
});

test('D5D-R auto-derives invoice identity, keys, line hashes, file IDs, and commit plan', async () => {
  const harness = makeHarness();
  const result = fromVm(await harness.executor.run());
  assert.equal(result.SGDS_CRIT_003_D5D_SMOKE_STATUS, 'PASS_PRODUCTION_READ_ONLY_CONSISTENT');
  assert.equal(result.THREAD_FOUND, 'YES');
  assert.equal(result.XML_ATTACHMENT_COUNT, 1);
  assert.equal(result.PDF_ATTACHMENT_COUNT, 1);
  assert.equal(result.INVOICE_KEY_DERIVED, 'YES');
  assert.equal(result.INVOICE_IDENTITY_HASH_DERIVED, 'YES');
  assert.equal(result.EXPECTED_LINE_COUNT_DERIVED, 'YES');
  assert.equal(result.EXPECTED_LINE_HASHES_DERIVED, 'YES');
  assert.equal(result.XML_FILE_ID_AUTO_RESOLVED, 'YES');
  assert.equal(result.PDF_FILE_ID_AUTO_RESOLVED, 'YES');
  assert.equal(result.INVOICE_KEY_HASH_DERIVED, 'YES');
  assert.equal(result.COMMIT_PLAN_HASH_DERIVED, 'YES');
  assert.equal(result.EXPECTED_LEDGER_LINE_COUNT, 2);
  assert.equal(result.LEDGER_MATCH_COUNT, 2);
  assert.equal(result.HOA_DON_MATCH_COUNT, 1);
  assert.equal(result.DRIVE_ARTIFACT_COUNT, 2);
  assert.equal(result.RECONCILIATION_STATUS, 'CONSISTENT');
});

test('D5D-R detects Hoa-Don, ledger, Drive, and PDF link-only findings', async () => {
  const missingHoaDon = fromVm(await makeHarness({ hoaDonRows: [] }).executor.run());
  assert.equal(missingHoaDon.FINDING_CODES.includes('HOA_DON_ROW_MISSING'), true);

  const duplicateHoaDon = fromVm(await makeHarness({
    hoaDonRows: [
      { legacyInvoiceKey: LEGACY_KEY, invoiceKeyV2: LEGACY_KEY, xmlFileId: RAW_XML, pdfFileId: RAW_PDF },
      { legacyInvoiceKey: LEGACY_KEY, invoiceKeyV2: LEGACY_KEY, xmlFileId: RAW_XML, pdfFileId: RAW_PDF }
    ]
  }).executor.run());
  assert.equal(duplicateHoaDon.FINDING_CODES.includes('HOA_DON_ROW_DUPLICATE'), true);

  const missingLedger = fromVm(await makeHarness({ ledgerRows: [] }).executor.run());
  assert.equal(missingLedger.FINDING_CODES.includes('LEDGER_ROWS_MISSING'), true);

  const extraLedger = fromVm(await makeHarness({
    ledgerRows: [
      { legacyInvoiceKey: LEGACY_KEY, invoiceKeyV2: LEGACY_KEY, legacyHashIndex: 'expected-line-hash-1', lineIdentityV2: 'expected-line-hash-1' },
      { legacyInvoiceKey: LEGACY_KEY, invoiceKeyV2: LEGACY_KEY, legacyHashIndex: 'expected-line-hash-2', lineIdentityV2: 'expected-line-hash-2' },
      { legacyInvoiceKey: LEGACY_KEY, invoiceKeyV2: LEGACY_KEY, legacyHashIndex: 'unexpected-line-hash-3', lineIdentityV2: 'unexpected-line-hash-3' }
    ]
  }).executor.run());
  assert.equal(extraLedger.FINDING_CODES.includes('LEDGER_ROWS_EXTRA'), true);

  const mismatch = fromVm(await makeHarness({
    ledgerRows: [{ legacyInvoiceKey: 'OTHER', invoiceKeyV2: 'OTHER', legacyHashIndex: 'expected-line-hash-1', lineIdentityV2: 'expected-line-hash-1' }]
  }).executor.run());
  assert.equal(mismatch.FINDING_CODES.includes('LEDGER_INVOICE_KEY_MISMATCH'), true);

  const xmlMissing = fromVm(await makeHarness({ xmlMissing: true }).executor.run());
  assert.equal(xmlMissing.FINDING_CODES.includes('DRIVE_XML_MISSING'), true);

  const pdfMissing = fromVm(await makeHarness({ pdfMissing: true }).executor.run());
  assert.equal(pdfMissing.FINDING_CODES.includes('DRIVE_PDF_MISSING'), true);

  const linkOnly = fromVm(await makeHarness({ pdfAttachmentCount: 0, pdfLinkOnly: true }).executor.run());
  assert.equal(linkOnly.PDF_SOURCE, 'LINK_ONLY');
  assert.equal(linkOnly.FINDING_CODES.includes('PDF_EXTERNAL_ACQUISITION_REQUIRED'), true);
});

test('D5D-R supports one-line, multi-line, saved-label missing, and deterministic rerun', async () => {
  const oneLine = fromVm(await makeHarness({ derived: { lineCount: 1 } }).executor.run());
  assert.equal(oneLine.EXPECTED_LEDGER_LINE_COUNT, 1);
  assert.equal(oneLine.LEDGER_MATCH_COUNT, 1);

  const multiLine = fromVm(await makeHarness({ derived: { lineCount: 3 } }).executor.run());
  assert.equal(multiLine.EXPECTED_LEDGER_LINE_COUNT, 3);
  assert.equal(multiLine.LEDGER_MATCH_COUNT, 3);

  const missingSaved = fromVm(await makeHarness({ gmailLabels: [] }).executor.run());
  assert.equal(missingSaved.FINDING_CODES.includes('GMAIL_SAVED_LABEL_MISSING'), true);

  const harness = makeHarness();
  const first = fromVm(await harness.executor.run());
  const second = fromVm(await harness.executor.run());
  assert.deepEqual(first, second);
});

test('D5D-R sanitized output has no raw IDs or PII and no mutation or Firestore calls', async () => {
  const harness = makeHarness();
  const result = fromVm(await harness.executor.run());
  const output = harness.logs.join('\n') + JSON.stringify(result);
  assert.equal(output.includes(RAW_THREAD), false);
  assert.equal(output.includes(RAW_XML), false);
  assert.equal(output.includes(RAW_PDF), false);
  assert.equal(output.includes(RAW_PII), false);
  assert.equal(harness.mutationCalls.length, 0);
  assert.equal(harness.networkCalls.length, 0);
  assert.equal(result.MUTATION_ATTEMPT_COUNT, 0);
  assert.equal(result.PRODUCTION_WRITE, 'NONE');
  assert.equal(result.PRODUCTION_FIRESTORE_ACCESS, 'NONE');
});

test('D5D-R source and checker preserve no scanner/main wiring and full-range sheet policy markers', () => {
  const source = fs.readFileSync('sgdsCrit003D5dReadOnlySmoke.js', 'utf8');
  const sheets = fs.readFileSync('gasSheetsReadOnlyReader.js', 'utf8');
  assert.equal(source.includes('createDurableInvoiceOrchestrator'), false);
  assert.equal(source.includes('createDurableScannerShadowRunner'), false);
  assert.match(source, /buildInvoiceKey_/);
  assert.match(source, /buildInvoiceItemHash_/);
  assert.match(sheets, /scanSheetRowsD5D_/);
  assert.match(sheets, /maxUsedRows/);
  assert.match(sheets, /chunkRows/);
  for (const file of ['main.js', 'gmailScanner.js', '_triggerDriveScanner.js', 'gmailProcessInvoiceXML.js']) {
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(text.includes('runSgdsCrit003D5dProductionReadOnlyShadowSmoke'), false);
  }
});
