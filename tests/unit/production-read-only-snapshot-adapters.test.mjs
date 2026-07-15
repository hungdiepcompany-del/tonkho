import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import {
  createD5CInput,
  createD5CReadOnlyFixtures,
  D5C_READ_FAILURE_CASES,
  D5C_TEST_SCENARIOS
} from '../../fixtures/production-read-only-snapshots/fake-production-read-only-snapshots.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['productionReadOnlySnapshotAdapters.js', 'durableReconciliation.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: [
    'durableReconciliation.js',
    'productionReadOnlySnapshotAdapters.js'
  ],
  exportNames: [
    'createProductionReadOnlySnapshotAdapters',
    'reconcileDurableInvoiceJobReportOnly',
    'D5C_IMPLEMENTATION_STATUS',
    'D5C_EXECUTION_MODE_',
    'D5C_READ_STATUSES_',
    'D5C_DEFAULT_LIMITS_'
  ]
});

const fromVm = (value) => JSON.parse(JSON.stringify(value));

const REQUIRED_D5C_TEST_MARKERS = [
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

function makeHarness(options = {}) {
  const fixtures = createD5CReadOnlyFixtures(options);
  const adapters = gas.call('createProductionReadOnlySnapshotAdapters', {
    gmailReader: fixtures.gmailReader,
    driveReader: fixtures.driveReader,
    sheetsReader: fixtures.sheetsReader,
    identityHasher: fixtures.identityHasher,
    clock: fixtures.clock,
    limits: options.limits
  });
  return { ...fixtures, adapters };
}

test('metadata', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
});

test('D5C exposes local-only read-only constants and complete scenario vocabulary', () => {
  assert.equal(gas.exports.D5C_IMPLEMENTATION_STATUS, 'LOCAL_ONLY');
  assert.equal(gas.exports.D5C_EXECUTION_MODE_, 'READ_ONLY');
  assert.equal(gas.exports.D5C_READ_STATUSES_.OK, 'READ_OK');
  assert.equal(gas.exports.D5C_TEST_SCENARIOS, undefined);
  assert.equal(D5C_TEST_SCENARIOS.length, 33);
  assert.equal(D5C_READ_FAILURE_CASES.length, 9);
  assert.equal(REQUIRED_D5C_TEST_MARKERS.every(marker => typeof marker === 'string'), true);
});

test('D5C exact Gmail thread found, saved label present, pending conflict, not found, and message limit exceeded', async () => {
  const saved = makeHarness();
  const savedSnapshot = fromVm(await saved.adapters.readGmailLabelSnapshot(saved.input));
  assert.equal(savedSnapshot.readStatus, 'READ_OK');
  assert.equal(savedSnapshot.exists, true);
  assert.equal(savedSnapshot.savedLabelPresent, true);
  assert.equal(savedSnapshot.attachmentSummary.xmlCount, 1);
  assert.equal(savedSnapshot.attachmentSummary.pdfCount, 1);
  assert.equal(savedSnapshot.sourceReferenceHashPrefix.length > 0, true);

  const pending = makeHarness({ gmailLabels: ['SGDS/PENDING', 'SGDS/SAVED'] });
  const pendingSnapshot = fromVm(await pending.adapters.readGmailLabelSnapshot(pending.input));
  assert.equal(pendingSnapshot.pendingLabelPresent, true);
  assert.equal(pendingSnapshot.savedLabelPresent, true);

  const missing = makeHarness({ gmailNotFound: true });
  const missingSnapshot = fromVm(await missing.adapters.readGmailLabelSnapshot(missing.input));
  assert.equal(missingSnapshot.readStatus, 'NOT_FOUND');

  const limited = makeHarness({ gmailMessageCount: 3, limits: { MAX_GMAIL_MESSAGES_PER_THREAD: 2 } });
  const limitedSnapshot = fromVm(await limited.adapters.readGmailLabelSnapshot(limited.input));
  assert.equal(limitedSnapshot.readStatus, 'READ_LIMIT_EXCEEDED');
});

test('D5C exact XML and PDF files, missing files, content hash mismatch, duplicate candidates, and invalid references are bounded', async () => {
  const found = makeHarness();
  const foundSnapshot = fromVm(await found.adapters.readDriveEvidenceSnapshot(found.input));
  assert.equal(foundSnapshot.readStatus, 'READ_OK');
  assert.equal(foundSnapshot.xml.exists, true);
  assert.equal(foundSnapshot.pdf.exists, true);
  assert.equal(foundSnapshot.xml.fileReferenceHashPrefix.length > 0, true);

  const missingXml = makeHarness({ xmlMissing: true });
  const missingXmlSnapshot = fromVm(await missingXml.adapters.readDriveEvidenceSnapshot(missingXml.input));
  assert.equal(missingXmlSnapshot.xml.readStatus, 'NOT_FOUND');

  const missingPdf = makeHarness({ pdfMissing: true });
  const missingPdfSnapshot = fromVm(await missingPdf.adapters.readDriveEvidenceSnapshot(missingPdf.input));
  assert.equal(missingPdfSnapshot.pdf.readStatus, 'NOT_FOUND');

  const mismatch = makeHarness({ xmlContentHash: 'differentHash' });
  const mismatchSnapshot = fromVm(await mismatch.adapters.readDriveEvidenceSnapshot(mismatch.input));
  assert.equal(mismatchSnapshot.xml.readStatus, 'CONTENT_HASH_MISMATCH');

  const duplicate = makeHarness({ duplicateCandidateCount: 4, limits: { MAX_DRIVE_DUPLICATE_CANDIDATES: 3 } });
  const duplicateSnapshot = fromVm(await duplicate.adapters.readDriveEvidenceSnapshot(duplicate.input));
  assert.equal(duplicateSnapshot.readStatus, 'READ_LIMIT_EXCEEDED');
  assert.equal(duplicateSnapshot.duplicateCandidateCount, 4);

  const invalid = makeHarness();
  const invalidInput = createD5CInput();
  invalidInput.sourceReferences = { gmailThreadReference: '', xmlFileReference: '', pdfFileReference: '' };
  invalidInput.commitPlan.driveEvidenceTargets = {};
  invalidInput.commitPlan.hoaDonRegistryTarget = {};
  const invalidSnapshot = fromVm(await invalid.adapters.readDriveEvidenceSnapshot(invalidInput));
  assert.equal(invalidSnapshot.xml.readStatus, 'REFERENCE_INVALID');
  assert.equal(invalidSnapshot.pdf.readStatus, 'REFERENCE_INVALID');
});

test('D5C Hoa-Don snapshot handles one row, missing row, duplicate rows, and missing XML/PDF references', async () => {
  const one = makeHarness();
  const oneSnapshot = fromVm(await one.adapters.readHoaDonSnapshot(one.input));
  assert.equal(oneSnapshot.readStatus, 'READ_OK');
  assert.equal(oneSnapshot.matchCount, 1);
  assert.equal(oneSnapshot.xmlReferencePresent, true);
  assert.equal(oneSnapshot.pdfReferencePresent, true);
  assert.equal(oneSnapshot.viewLinkPresent, true);

  const missing = makeHarness({ hoaDonRows: [] });
  const missingSnapshot = fromVm(await missing.adapters.readHoaDonSnapshot(missing.input));
  assert.equal(missingSnapshot.readStatus, 'NOT_FOUND');

  const duplicateRows = [oneSnapshot.observedRows[0], oneSnapshot.observedRows[0]];
  const duplicate = makeHarness({ hoaDonRows: duplicateRows });
  const duplicateSnapshot = fromVm(await duplicate.adapters.readHoaDonSnapshot(duplicate.input));
  assert.equal(duplicateSnapshot.readStatus, 'MULTIPLE_MATCHES');
  assert.equal(duplicateSnapshot.duplicate, true);

  const noRefs = makeHarness({ hoaDonRows: [{ legacyInvoiceKey: one.input.commitPlan.legacyInvoiceKey, invoiceKeyV2: one.input.commitPlan.invoiceKeyV2 }] });
  const noRefsSnapshot = fromVm(await noRefs.adapters.readHoaDonSnapshot(noRefs.input));
  assert.equal(noRefsSnapshot.xmlReferencePresent, false);
  assert.equal(noRefsSnapshot.pdfReferencePresent, false);
});

test('D5C ledger snapshot handles one-line, multi-line, missing, extra, blank, inconsistent, and duplicate line states', async () => {
  const oneLine = makeHarness({ lineCount: 1 });
  const oneLineSnapshot = fromVm(await oneLine.adapters.readLedgerSnapshot(oneLine.input));
  assert.equal(oneLineSnapshot.readStatus, 'READ_OK');
  assert.equal(oneLineSnapshot.matchCount, 1);
  assert.equal(oneLineSnapshot.lineCountMatches, true);

  const multiLine = makeHarness({ lineCount: 2 });
  const multiLineSnapshot = fromVm(await multiLine.adapters.readLedgerSnapshot(multiLine.input));
  assert.equal(multiLineSnapshot.matchCount, 2);
  assert.equal(multiLineSnapshot.hashIndexPresentCount, 2);
  assert.equal(multiLineSnapshot.invoiceKeyPresentCount, 2);
  assert.equal(multiLineSnapshot.invoiceKeyConsistent, true);

  const missing = makeHarness({ ledgerRows: [multiLine.input.commitPlan.lines[0]].map(line => ({
    legacyInvoiceKey: multiLine.input.commitPlan.legacyInvoiceKey,
    invoiceKeyV2: multiLine.input.commitPlan.invoiceKeyV2,
    legacyHashIndex: line.legacyHashIndex,
    lineIdentityV2: line.lineIdentityV2
  })) });
  const missingSnapshot = fromVm(await missing.adapters.readLedgerSnapshot(missing.input));
  assert.equal(missingSnapshot.lineCountMatches, false);

  const extraRows = [
    ...multiLineSnapshot.observedRows,
    { legacyInvoiceKey: multiLine.input.commitPlan.legacyInvoiceKey, invoiceKeyV2: multiLine.input.commitPlan.invoiceKeyV2, legacyHashIndex: 'synthetic-extra-hash', lineIdentityV2: 'synthetic-extra-line' }
  ];
  const extra = makeHarness({ ledgerRows: extraRows });
  const extraSnapshot = fromVm(await extra.adapters.readLedgerSnapshot(extra.input));
  assert.equal(extraSnapshot.lineCountMatches, false);

  const blankHash = makeHarness({ ledgerRows: [{ legacyInvoiceKey: multiLine.input.commitPlan.legacyInvoiceKey, invoiceKeyV2: multiLine.input.commitPlan.invoiceKeyV2, legacyHashIndex: '', lineIdentityV2: 'synthetic-line' }] });
  const blankHashSnapshot = fromVm(await blankHash.adapters.readLedgerSnapshot(blankHash.input));
  assert.equal(blankHashSnapshot.hashIndexPresentCount, 0);

  const blankKey = makeHarness({ ledgerRows: [{ legacyInvoiceKey: '', invoiceKeyV2: '', legacyHashIndex: 'synthetic-hash', lineIdentityV2: 'synthetic-line' }] });
  const blankKeySnapshot = fromVm(await blankKey.adapters.readLedgerSnapshot(blankKey.input));
  assert.equal(blankKeySnapshot.invoiceKeyPresentCount, 0);

  const inconsistent = makeHarness({ ledgerRows: [
    { legacyInvoiceKey: 'A', invoiceKeyV2: 'A', legacyHashIndex: 'h1', lineIdentityV2: 'line1' },
    { legacyInvoiceKey: 'B', invoiceKeyV2: 'B', legacyHashIndex: 'h2', lineIdentityV2: 'line2' }
  ] });
  const inconsistentSnapshot = fromVm(await inconsistent.adapters.readLedgerSnapshot(inconsistent.input));
  assert.equal(inconsistentSnapshot.invoiceKeyConsistent, false);

  const duplicateLine = makeHarness({ ledgerRows: [
    { legacyInvoiceKey: 'A', invoiceKeyV2: 'A', legacyHashIndex: 'h1', lineIdentityV2: 'line1' },
    { legacyInvoiceKey: 'A', invoiceKeyV2: 'A', legacyHashIndex: 'h2', lineIdentityV2: 'line1' }
  ] });
  const duplicateLineSnapshot = fromVm(await duplicateLine.adapters.readLedgerSnapshot(duplicateLine.input));
  assert.equal(duplicateLineSnapshot.duplicateLineIdentityCount, 1);
});

test('D5C builds complete and partial reconciliation snapshots compatible with report-only reconciliation', async () => {
  const complete = makeHarness();
  const snapshot = fromVm(await complete.adapters.buildDurableReconciliationSnapshot(complete.input));
  assert.equal(snapshot.snapshotMeta.mode, 'READ_ONLY');
  assert.equal(snapshot.snapshotMeta.sanitized, true);
  assert.equal(snapshot.observed.driveEvidence.length, 2);
  assert.equal(snapshot.observed.hoaDonRows.length, 1);
  assert.equal(snapshot.observed.ledgerRows.length, 2);
  assert.equal(snapshot.observed.gmailLabels.includes('SGDS/SAVED'), true);
  const report = gas.exports.reconcileDurableInvoiceJobReportOnly(snapshot);
  assert.equal(fromVm(report).status, 'CONSISTENT');

  const partial = makeHarness({ xmlMissing: true, hoaDonRows: [], ledgerRows: [] });
  const partialSnapshot = fromVm(await partial.adapters.buildDurableReconciliationSnapshot(partial.input));
  const partialReport = fromVm(gas.exports.reconcileDurableInvoiceJobReportOnly(partialSnapshot));
  assert.notEqual(partialReport.status, 'CONSISTENT');
});

test('D5C adapter read failures are sanitized and do not throw raw exceptions into snapshots', async () => {
  const gmailFailure = makeHarness({ failures: { GMAIL_READ: 'GMAIL_SYNTHETIC_FAILURE' } });
  const gmailSnapshot = fromVm(await gmailFailure.adapters.readGmailLabelSnapshot(gmailFailure.input));
  assert.equal(gmailSnapshot.readStatus, 'READ_FAILED');
  assert.equal(gmailSnapshot.errorCode, 'GMAIL_SYNTHETIC_FAILURE');

  const driveFailure = makeHarness({ failures: { DRIVE_READ: 'DRIVE_SYNTHETIC_FAILURE' } });
  const driveSnapshot = fromVm(await driveFailure.adapters.readDriveEvidenceSnapshot(driveFailure.input));
  assert.equal(driveSnapshot.readStatus, 'READ_FAILED');

  const sheetFailure = makeHarness({ failures: { HOA_DON_READ: 'SHEET_SYNTHETIC_FAILURE' } });
  const hoaDonSnapshot = fromVm(await sheetFailure.adapters.readHoaDonSnapshot(sheetFailure.input));
  assert.equal(hoaDonSnapshot.readStatus, 'READ_FAILED');
  assert.equal(hoaDonSnapshot.errorCode, 'SHEET_SYNTHETIC_FAILURE');
});

test('D5C snapshot ordering is deterministic and input remains immutable', async () => {
  const first = makeHarness();
  const before = JSON.stringify(first.input);
  const firstSnapshot = fromVm(await first.adapters.buildDurableReconciliationSnapshot(first.input));
  const secondSnapshot = fromVm(await first.adapters.buildDurableReconciliationSnapshot(first.input));
  assert.deepEqual(firstSnapshot, secondSnapshot);
  assert.equal(JSON.stringify(first.input), before);
});

test('D5C snapshots contain no raw identifiers or invoice PII from exact references', async () => {
  const harness = makeHarness();
  const snapshot = fromVm(await harness.adapters.buildDurableReconciliationSnapshot(harness.input));
  const output = JSON.stringify(snapshot);
  assert.equal(output.includes('RAW_GMAIL_THREAD_ID_SHOULD_NOT_LEAK_D5C'), false);
  assert.equal(output.includes('RAW_XML_FILE_ID_SHOULD_NOT_LEAK_D5C'), false);
  assert.equal(output.includes('RAW_PDF_FILE_ID_SHOULD_NOT_LEAK_D5C'), false);
  assert.equal(output.includes('0100000001'), false);
  assert.equal(output.includes('C26THD8'), false);
});

test('D5C has zero mutation method calls, zero production network calls, and no scanner/main wiring', async () => {
  const harness = makeHarness();
  await harness.adapters.buildDurableReconciliationSnapshot(harness.input);
  assert.equal(harness.mutationCalls.length, 0);
  assert.equal(harness.networkCalls.length, 0);

  const source = fs.readFileSync('productionReadOnlySnapshotAdapters.js', 'utf8');
  const runtimeFiles = ['main.js', 'gmailScanner.js', '_triggerDriveScanner.js', 'gmailProcessInvoiceXML.js'];
  for (const file of runtimeFiles) {
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(text.includes('createProductionReadOnlySnapshotAdapters'), false, `${file} must not wire D5C`);
  }
  assert.equal(source.includes('GmailApp'), false);
  assert.equal(source.includes('DriveApp'), false);
  assert.equal(source.includes('SpreadsheetApp'), false);
});
