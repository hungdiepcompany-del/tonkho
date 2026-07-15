const BASE_JOB_ID = 'synthetic-job-001';
const LEGACY_INVOICE_KEY = 'SYNTHETIC_LEGACY_INVOICE_KEY';
const INVOICE_KEY_V2 = 'SYNTHETIC_INVOICE_KEY_V2';

export const D3_FIXTURE_NAMES = Object.freeze([
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
]);

export const D3_EXPECTED_CODES = Object.freeze({
  allSystemsConsistent: [],
  driveSavedHoaDonMissing: ['STATE_AHEAD_OF_EVIDENCE', 'TERMINAL_STATE_CONFLICT', 'HOA_DON_ROW_MISSING'],
  hoaDonExistsLedgerMissing: ['STATE_AHEAD_OF_EVIDENCE', 'TERMINAL_STATE_CONFLICT', 'LEDGER_ROWS_MISSING', 'GMAIL_FALSE_SAVED_LABEL'],
  partialLedgerLineCommit: ['STATE_AHEAD_OF_EVIDENCE', 'TERMINAL_STATE_CONFLICT', 'LEDGER_ROWS_MISSING', 'GMAIL_FALSE_SAVED_LABEL'],
  extraLedgerLine: ['LEDGER_ROWS_EXTRA', 'GMAIL_SAVED_LABEL_MISSING'],
  wrongLineHash: ['STATE_AHEAD_OF_EVIDENCE', 'TERMINAL_STATE_CONFLICT', 'LEDGER_ROWS_MISSING', 'LEDGER_ROWS_EXTRA', 'LEDGER_LINE_HASH_MISMATCH', 'GMAIL_FALSE_SAVED_LABEL'],
  wrongInvoiceKey: ['STATE_AHEAD_OF_EVIDENCE', 'TERMINAL_STATE_CONFLICT', 'LEDGER_ROWS_MISSING', 'LEDGER_ROWS_EXTRA', 'LEDGER_INVOICE_KEY_MISMATCH', 'GMAIL_FALSE_SAVED_LABEL'],
  savedGmailLabelBeforeLedgerCommit: ['LEDGER_ROWS_MISSING', 'GMAIL_FALSE_SAVED_LABEL'],
  ledgerCommittedSavedLabelMissing: ['STATE_AHEAD_OF_EVIDENCE', 'GMAIL_SAVED_LABEL_MISSING'],
  duplicateDriveXml: ['STATE_AHEAD_OF_EVIDENCE', 'TERMINAL_STATE_CONFLICT', 'DRIVE_ARTIFACT_DUPLICATE'],
  duplicateHoaDonRow: ['STATE_AHEAD_OF_EVIDENCE', 'TERMINAL_STATE_CONFLICT', 'HOA_DON_ROW_DUPLICATE'],
  jobCompletedEvidenceIncomplete: ['STATE_AHEAD_OF_EVIDENCE', 'TERMINAL_STATE_CONFLICT', 'DRIVE_XML_MISSING', 'DRIVE_PDF_MISSING', 'HOA_DON_ROW_MISSING', 'LEDGER_ROWS_MISSING'],
  jobBehindObservedEvidence: ['STATE_BEHIND_EVIDENCE'],
  commitPlanHashMismatch: ['COMMIT_PLAN_HASH_MISMATCH', 'STATE_AHEAD_OF_EVIDENCE', 'TERMINAL_STATE_CONFLICT', 'LEDGER_ROWS_MISSING', 'LEDGER_ROWS_EXTRA', 'LEDGER_LINE_HASH_MISMATCH', 'GMAIL_FALSE_SAVED_LABEL'],
  terminalStateConflict: ['STATE_AHEAD_OF_EVIDENCE', 'TERMINAL_STATE_CONFLICT', 'DRIVE_PDF_MISSING', 'HOA_DON_FILE_REFERENCE_MISMATCH'],
  multiLineInvoiceValid: [],
  sameInputReconciledTwice: []
});

export function createD3Fixture(name = 'allSystemsConsistent') {
  const fixture = baseFixture();
  switch (name) {
    case 'allSystemsConsistent':
    case 'multiLineInvoiceValid':
    case 'sameInputReconciledTwice':
      return fixture;
    case 'driveSavedHoaDonMissing':
      fixture.observed.hoaDonRows = [];
      return fixture;
    case 'hoaDonExistsLedgerMissing':
      fixture.observed.ledgerRows = [];
      return fixture;
    case 'partialLedgerLineCommit':
      fixture.observed.ledgerRows = [fixture.observed.ledgerRows[0]];
      return fixture;
    case 'extraLedgerLine':
      fixture.job.state = 'ROWS_COMMITTED';
      fixture.observed.gmailLabels = [];
      fixture.observed.ledgerRows.push({
        legacyInvoiceKey: LEGACY_INVOICE_KEY,
        invoiceKeyV2: INVOICE_KEY_V2,
        legacyHashIndex: 'synthetic-extra-line-hash',
        lineIdentityV2: 'synthetic-extra-line-id'
      });
      return fixture;
    case 'wrongLineHash':
      fixture.observed.ledgerRows[1].legacyHashIndex = 'synthetic-wrong-line-hash';
      return fixture;
    case 'wrongInvoiceKey':
      fixture.observed.ledgerRows[1].legacyInvoiceKey = 'SYNTHETIC_OTHER_INVOICE_KEY';
      fixture.observed.ledgerRows[1].invoiceKeyV2 = 'SYNTHETIC_OTHER_INVOICE_KEY_V2';
      return fixture;
    case 'savedGmailLabelBeforeLedgerCommit':
      fixture.job.state = 'FILES_SAVED';
      fixture.observed.ledgerRows = [];
      fixture.observed.gmailLabels = ['SAVED_SHEET'];
      return fixture;
    case 'ledgerCommittedSavedLabelMissing':
      fixture.job.state = 'PROJECTIONS_COMMITTED';
      fixture.observed.gmailLabels = [];
      return fixture;
    case 'duplicateDriveXml':
      fixture.observed.driveEvidence.push({ kind: 'XML', contentHash: 'synthetic-xml-content-hash', fileId: 'synthetic-xml-file-copy' });
      return fixture;
    case 'duplicateHoaDonRow':
      fixture.observed.hoaDonRows.push(clone(fixture.observed.hoaDonRows[0]));
      return fixture;
    case 'jobCompletedEvidenceIncomplete':
      fixture.observed.driveEvidence = [];
      fixture.observed.hoaDonRows = [];
      fixture.observed.ledgerRows = [];
      fixture.observed.gmailLabels = [];
      return fixture;
    case 'jobBehindObservedEvidence':
      fixture.job.state = 'VALIDATED';
      return fixture;
    case 'commitPlanHashMismatch':
      fixture.job.commitPlan = clone(fixture.commitPlan);
      fixture.commitPlan.lines[1].legacyHashIndex = 'synthetic-mutated-plan-hash';
      fixture.commitPlan.legacyHashIndexes[1] = 'synthetic-mutated-plan-hash';
      return fixture;
    case 'terminalStateConflict':
      fixture.observed.driveEvidence = fixture.observed.driveEvidence.filter(entry => entry.kind !== 'PDF');
      fixture.observed.hoaDonRows[0].pdfContentHash = 'synthetic-different-pdf-content-hash';
      return fixture;
    default:
      throw new Error(`UNKNOWN_D3_FIXTURE:${name}`);
  }
}

function baseFixture() {
  const commitPlan = {
    version: 'DURABLE_COMMIT_PLAN_V1',
    jobId: BASE_JOB_ID,
    legacyInvoiceKey: LEGACY_INVOICE_KEY,
    invoiceKeyV2: INVOICE_KEY_V2,
    expectedLineCount: 2,
    legacyHashIndexes: ['synthetic-line-hash-1', 'synthetic-line-hash-2'],
    lineIdentityV2s: ['synthetic-line-id-1', 'synthetic-line-id-2'],
    lines: [
      {
        sourceLineNo: 1,
        legacyHashIndex: 'synthetic-line-hash-1',
        lineIdentityV2: 'synthetic-line-id-1',
        immutableFields: { syntheticLineNo: 1, quantityBucket: 'ONE' }
      },
      {
        sourceLineNo: 2,
        legacyHashIndex: 'synthetic-line-hash-2',
        lineIdentityV2: 'synthetic-line-id-2',
        immutableFields: { syntheticLineNo: 2, quantityBucket: 'TWO' }
      }
    ],
    hoaDonRegistryTarget: {
      legacyInvoiceKey: LEGACY_INVOICE_KEY,
      xmlContentHash: 'synthetic-xml-content-hash',
      pdfContentHash: 'synthetic-pdf-content-hash',
      xmlFileId: 'synthetic-xml-file',
      pdfFileId: 'synthetic-pdf-file'
    },
    driveEvidenceTargets: {
      xmlContentHash: 'synthetic-xml-content-hash',
      pdfContentHash: 'synthetic-pdf-content-hash'
    },
    preCommitLedgerProbe: { status: 'NO_ROWS_PRESENT' }
  };

  return {
    generatedAt: '2026-07-15T00:00:00.000Z',
    job: {
      jobId: BASE_JOB_ID,
      state: 'COMPLETED',
      sourceFingerprint: 'synthetic-source-fingerprint',
      legacyInvoiceKey: LEGACY_INVOICE_KEY,
      invoiceKeyV2: INVOICE_KEY_V2,
      commitPlan: clone(commitPlan)
    },
    commitPlan,
    observed: {
      driveEvidence: [
        { kind: 'XML', contentHash: 'synthetic-xml-content-hash', fileId: 'synthetic-xml-file' },
        { kind: 'PDF', contentHash: 'synthetic-pdf-content-hash', fileId: 'synthetic-pdf-file' }
      ],
      hoaDonRows: [
        {
          legacyInvoiceKey: LEGACY_INVOICE_KEY,
          invoiceKeyV2: INVOICE_KEY_V2,
          xmlContentHash: 'synthetic-xml-content-hash',
          pdfContentHash: 'synthetic-pdf-content-hash',
          xmlFileId: 'synthetic-xml-file',
          pdfFileId: 'synthetic-pdf-file'
        }
      ],
      ledgerRows: [
        {
          legacyInvoiceKey: LEGACY_INVOICE_KEY,
          invoiceKeyV2: INVOICE_KEY_V2,
          legacyHashIndex: 'synthetic-line-hash-1',
          lineIdentityV2: 'synthetic-line-id-1'
        },
        {
          legacyInvoiceKey: LEGACY_INVOICE_KEY,
          invoiceKeyV2: INVOICE_KEY_V2,
          legacyHashIndex: 'synthetic-line-hash-2',
          lineIdentityV2: 'synthetic-line-id-2'
        }
      ],
      gmailLabels: ['SAVED_SHEET']
    }
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}