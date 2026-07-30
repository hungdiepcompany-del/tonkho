import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'D7_E3G_PartialStateReadOnlyDiagnostic.js',
    'Operator_Entrypoints.js',
    'D7_B_BoundedReadOnlyCandidateDiscovery.js',
    'D7_E_OwnerApprovedOneCandidateProductionPilot.js',
    'scripts/checkers/check-d7-e3g-partial-state-read-only-diagnostic.mjs'
  ],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: [
    'sgdsAdapterErrors.js',
    'sgdsDriveAdapter.js',
    'sgdsSheetsLedgerAdapter.js',
    'durableJobState.js',
    'firestoreRestGateway.js',
    'firestoreDurableJobStore.js',
    'D7_B_BoundedReadOnlyCandidateDiscovery.js',
    'D7_E_OwnerApprovedOneCandidateProductionPilot.js',
    'D7_E3G_PartialStateReadOnlyDiagnostic.js',
    'Operator_Entrypoints.js'
  ],
  exportNames: [
    'D7_E3G_SCHEMA_VERSION_',
    'D7_E3G_PUBLIC_ENTRYPOINT_',
    'createD7EPartialStateReadOnlyDiagnosticRunner_',
    'runD7EPartialStateReadOnlyDiagnostic',
    'classifyD7E3GXmlConflict_',
    'validateD7E3GFirestoreDocumentPath_',
    'validateD7E3GFirestoreCollectionPath_',
    'sanitizeD7E3GString_'
  ]
});

const fromVm = value => JSON.parse(JSON.stringify(value));
const expectedXml = 'cbf4cc62c466e8a94561f862685241060e0302e3ac9067cdacf8bdf4ede984f3';
const expectedPdf = '7c8f7b7a577d9fd83ff1581408113b956166ed95f13704aaed2a3769d8136b07';
const expectedCandidate = '3a9aed9dd9050acf6a7b2b59fa47b662a87d3dde011d5cec277f42e223ac79bc';
const expectedInvoice = 'd7b9112f07b5df9cb0c3acedecda88d560baa5bc31e61d7f7a63aca41a54b614';
const expectedAttachmentSet = '8b548919f7b0f1035a264a7fb1b92ba978a32a047edf0d75d18c54072660af58';

test('metadata and public entrypoint contract are canonical', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(gas.exports.D7_E3G_SCHEMA_VERSION_, 'D7_E3G_PARTIAL_STATE_READ_ONLY_DIAGNOSTIC_V1');
  assert.equal(gas.exports.D7_E3G_PUBLIC_ENTRYPOINT_, 'runD7EPartialStateReadOnlyDiagnostic');
  assert.equal(typeof gas.exports.runD7EPartialStateReadOnlyDiagnostic, 'function');
  const entrypoints = fs.readFileSync('Operator_Entrypoints.js', 'utf8');
  const match = entrypoints.match(/function runD7EPartialStateReadOnlyDiagnostic\(\) \{([\s\S]*?)\n\}/);
  assert.ok(match, 'D7_E3G_ENTRYPOINT_MISSING');
  assert.match(match[1], /const runner = createD7EPartialStateReadOnlyDiagnosticRunner_\(\);/);
  assert.match(match[1], /return runner\.run\(\);/);
  assert.doesNotMatch(match[1], /runD7EOwnerApprovedOneCandidateProductionPilot|runD6jCOneRecordProductionMutation/);
});

function rediscovery(overrides = {}) {
  const summary = {
    CANDIDATE_REDISCOVERY_STATUS: 'PASS',
    CANDIDATE_DISCOVERY_EXECUTED: 'YES_READ_ONLY',
    ELIGIBLE_CANDIDATE_COUNT: 1,
    INSPECTED_ATTACHMENT_COUNT: 2,
    CANDIDATE_FINGERPRINT_MATCH: 'YES',
    INVOICE_KEY_HASH_MATCH: 'YES',
    ATTACHMENT_SET_SHA256_MATCH: 'YES',
    XML_SOURCE_SHA256_MATCH: 'YES',
    PDF_SOURCE_SHA256_MATCH: 'YES',
    CANDIDATE_FINGERPRINT: expectedCandidate,
    INVOICE_KEY_HASH: expectedInvoice,
    ATTACHMENT_SET_SHA256: expectedAttachmentSet,
    XML_SHA256: expectedXml,
    PDF_SHA256: expectedPdf,
    ...(overrides.summary || {})
  };
  return {
    status: overrides.status || 'PASS',
    config: { folderId: 'folder-redacted', spreadsheetId: 'sheet-redacted', sheetName: 'Nhap-Xuat' },
    candidate: {
      message: { messageIdHash: '9e12d76a0f2b6c16', threadIdHash: '9e12d76a0f2b6c16' },
      xml: { sha256: expectedXml, mime: 'application/xml', size: 42 },
      pdf: { sha256: expectedPdf, mime: 'application/pdf', size: 24 }
    },
    fingerprint: { summary },
    precheck: { summary, config: { folderId: 'folder-redacted', spreadsheetId: 'sheet-redacted', sheetName: 'Nhap-Xuat' } },
    summary
  };
}

function planContext(overrides = {}) {
  return {
    plan: {
      jobId: 'd7e_job_b9e4386aa755b9dcaabbccdd',
      invoiceIdentityHash: expectedCandidate,
      commitPlan: { jobId: 'd7e_job_b9e4386aa755b9dcaabbccdd', lines: [{ sourceLineNo: 1 }] },
      ledgerRows: [
        {
          transactionIdentity: 'line-redacted',
          lineIdentityV2: 'line-redacted',
          legacyHashIndex: 'hash-redacted',
          invoiceKeyV2: 'invoice-redacted',
          legacyInvoiceKey: 'invoice-redacted'
        }
      ],
      driveTargets: {
        xml: { fileName: 'xml.invoice', contentHash: expectedXml, byteSize: 42, mimeType: 'application/xml', logicalFileIdentity: 'xml-logical-redacted', folderReference: 'folder-redacted' },
        pdf: { fileName: 'pdf.invoice', contentHash: expectedPdf, byteSize: 24, mimeType: 'application/pdf', logicalFileIdentity: 'pdf-logical-redacted', folderReference: 'folder-redacted' }
      },
      attachmentRecords: [{ attachmentId: 'd7e_att_xmlredacted' }, { attachmentId: 'd7e_att_pdfredacted' }]
    },
    summary: {
      EXPECTED_JOB_ID_DERIVED: 'YES',
      EXPECTED_JOB_ID_HASH_PREFIX: 'b9e4386aa755b9dc',
      EXPECTED_LEDGER_ROW_COUNT: 1,
      EXPECTED_XML_LOGICAL_IDENTITY_DERIVED: 'YES',
      EXPECTED_PDF_LOGICAL_IDENTITY_DERIVED: 'YES',
      EXPECTED_SHEET_TRANSACTION_IDENTITY_DERIVED: 'YES',
      ...(overrides.summary || {})
    }
  };
}

function firestore(overrides = {}) {
  return {
    FIRESTORE_READ_STATUS: 'READ_OK',
    FIRESTORE_JOB_FOUND: 'YES',
    FIRESTORE_JOB_IDENTITY_MATCH: 'YES',
    FIRESTORE_JOB_STATUS: 'VALIDATED',
    FIRESTORE_JOB_RECONCILIATION_STATUS: 'RECONCILIATION_REQUIRED',
    FIRESTORE_JOB_VERSION_PRESENT: 'YES',
    FIRESTORE_COMMIT_PLAN_FOUND: 'YES',
    FIRESTORE_COMMIT_PLAN_IDENTITY_MATCH: 'YES',
    FIRESTORE_COMMIT_PLAN_HASH_MATCH: 'YES',
    FIRESTORE_LEASE_FOUND: 'YES',
    FIRESTORE_LEASE_STATUS: 'RECONCILIATION_REQUIRED',
    FIRESTORE_LEASE_OWNER_MATCH: 'YES',
    FIRESTORE_LEASE_EXPIRED: 'YES',
    FIRESTORE_AUDIT_EVENT_COUNT: 2,
    FIRESTORE_RECONCILIATION_REPORT_FOUND: 'YES',
    FIRESTORE_RECONCILIATION_STATUS: 'RECONCILIATION_REQUIRED',
    FIRESTORE_RECONCILIATION_FINDING_CODES: 'D7_E_PARTIAL_FAILURE',
    FIRESTORE_ATTACHMENT_RECORD_COUNT: 0,
    FIRESTORE_MUTATION_ATTEMPT_COUNT: 0,
    FIRESTORE_MUTATION_COUNT: 0,
    ...overrides
  };
}

function driveAdapter(overrides = {}) {
  return {
    DRIVE_ADAPTER_XML_READ_STATUS: 'READ_OK',
    DRIVE_ADAPTER_XML_ERROR_CODE: 'NONE',
    DRIVE_ADAPTER_PDF_READ_STATUS: 'READ_OK',
    DRIVE_ADAPTER_PDF_ERROR_CODE: 'NONE',
    ADAPTER_REPORTED_XML_HASH: expectedXml,
    ADAPTER_REPORTED_PDF_HASH: expectedPdf,
    ...overrides
  };
}

function driveRaw(overrides = {}) {
  return {
    DRIVE_READ_STATUS: 'READ_OK',
    DRIVE_EXPECTED_FILE_COUNT: 2,
    DRIVE_XML_CANDIDATE_COUNT: 1,
    DRIVE_XML_MATCHED_FILE_COUNT: 1,
    DRIVE_XML_ACTUAL_SHA256: expectedXml,
    DRIVE_XML_EXPECTED_SHA256: expectedXml,
    DRIVE_XML_HASH_MATCH: 'YES',
    DRIVE_XML_BYTE_SIZE_MATCH: 'YES',
    DRIVE_XML_MIME_TYPE_MATCH: 'YES',
    DRIVE_XML_LOGICAL_IDENTITY_MATCH: 'YES',
    DRIVE_XML_DESTINATION_MATCH: 'YES',
    DRIVE_XML_STORED_METADATA_HASH_MATCH: 'NOT_AVAILABLE',
    DRIVE_PDF_CANDIDATE_COUNT: 1,
    DRIVE_PDF_MATCHED_FILE_COUNT: 1,
    DRIVE_PDF_ACTUAL_SHA256: expectedPdf,
    DRIVE_PDF_EXPECTED_SHA256: expectedPdf,
    DRIVE_PDF_HASH_MATCH: 'YES',
    DRIVE_PDF_BYTE_SIZE_MATCH: 'YES',
    DRIVE_PDF_MIME_TYPE_MATCH: 'YES',
    DRIVE_PDF_LOGICAL_IDENTITY_MATCH: 'YES',
    DRIVE_PDF_DESTINATION_MATCH: 'YES',
    DRIVE_PDF_STORED_METADATA_HASH_MATCH: 'NOT_AVAILABLE',
    DRIVE_MATCHED_FILE_COUNT: 2,
    DRIVE_EXTRA_CONFLICT_FILE_COUNT: 0,
    DRIVE_DUPLICATE_STATUS: 'NO_CONFLICTING_DUPLICATES',
    DRIVE_XML_CONFLICT_CLASSIFICATION: 'XML_CONFLICT_NOT_REPRODUCIBLE_CURRENT_FILES_VALID',
    DRIVE_MUTATION_ATTEMPT_COUNT: 0,
    DRIVE_MUTATION_COUNT: 0,
    ...overrides
  };
}

function sheets(overrides = {}) {
  return {
    SHEET_READ_STATUS: 'READ_OK',
    SHEET_SCHEMA_STATUS: 'PASS',
    SHEET_CANONICAL_MATCHING_ROW_COUNT: 0,
    SHEET_EXACT_MATCHING_ROW_COUNT: 0,
    SHEET_CONFLICTING_ROW_COUNT: 0,
    SHEET_ROWS_CREATED_BY_D7_E_ATTEMPT: 0,
    SHEET_DUPLICATE_STATUS: 'CONFIRMED_NOT_WRITTEN',
    SHEETS_MUTATION_ATTEMPT_COUNT: 0,
    SHEETS_MUTATION_COUNT: 0,
    ...overrides
  };
}

function gmail(overrides = {}) {
  return {
    GMAIL_READ_STATUS: 'READ_OK',
    GMAIL_CANDIDATE_FOUND: 'YES',
    GMAIL_CANDIDATE_CARDINALITY: 1,
    GMAIL_MESSAGE_COUNT: 1,
    GMAIL_XML_ATTACHMENT_COUNT: 1,
    GMAIL_PDF_ATTACHMENT_COUNT: 1,
    GMAIL_COMPLETION_LABEL_PRESENT: 'NO',
    GMAIL_PROJECTION_MUTATION_FOUND: 'NO',
    GMAIL_CANDIDATE_FINGERPRINT_STILL_MATCHES: 'YES',
    GMAIL_MUTATION_ATTEMPT_COUNT: 0,
    GMAIL_MUTATION_COUNT: 0,
    ...overrides
  };
}

async function runScenario(overrides = {}) {
  const logs = [];
  let driveCall = 0;
  const runner = gas.call('createD7EPartialStateReadOnlyDiagnosticRunner_', {
    readProperties: () => ({}),
    rediscoverCandidate: () => rediscovery(overrides.rediscovery || {}),
    reconstructPlan: () => planContext(overrides.plan || {}),
    inspectFirestore: () => firestore(overrides.firestore || {}),
    inspectDriveAdapter: () => driveAdapter(overrides.driveAdapter || {}),
    inspectDriveRaw: () => {
      driveCall += 1;
      if (overrides.driveSequence) return driveRaw(overrides.driveSequence[Math.min(driveCall - 1, overrides.driveSequence.length - 1)]);
      return driveRaw(overrides.drive || {});
    },
    inspectSheets: () => sheets(overrides.sheets || {}),
    inspectGmail: () => gmail(overrides.gmail || {}),
    now: () => '2026-07-30T00:00:00.000Z',
    logger: { log: line => logs.push(String(line)) }
  });
  return { result: fromVm(await runner.run()), logs };
}

function assertTripwire(result) {
  assert.equal(result.D7_E3G_EXECUTION_ATTEMPT_COUNT, 1);
  assert.equal(result.D7_E_RERUN_ATTEMPT_COUNT, 0);
  assert.equal(result.D6J_C_PUBLIC_ENTRYPOINT_EXECUTION_COUNT, 0);
  assert.equal(result.SCRIPT_PROPERTY_MUTATION_COUNT, 0);
  assert.equal(result.GMAIL_MUTATION_COUNT, 0);
  assert.equal(result.DRIVE_MUTATION_COUNT, 0);
  assert.equal(result.SHEETS_MUTATION_COUNT, 0);
  assert.equal(result.FIRESTORE_MUTATION_COUNT, 0);
  assert.equal(result.TRIGGER_MUTATION_COUNT, 0);
  assert.equal(result.DESTRUCTIVE_OPERATION_COUNT, 0);
  assert.equal(result.PRODUCTION_MUTATION_COUNT, 0);
  assert.equal(result.PRODUCTION_MUTATION, 'NONE');
}

test('exact approved candidate with valid partial state classifies verified Drive and absent Sheet', async () => {
  const { result } = await runScenario();
  assert.equal(result.STATUS, 'PASS_D7_E3G_READ_ONLY_DIAGNOSTIC_COMPLETE');
  assert.equal(result.PARTIAL_STATE, 'DRIVE_ARTIFACTS_VALID_SHEET_ABSENT_FIRESTORE_RECONCILIATION_REQUIRED');
  assert.equal(result.BEFORE_AFTER_SNAPSHOT_MATCH, 'YES');
  assert.equal(result.CANDIDATE_FINGERPRINT_MATCH, 'YES');
  assert.equal(result.FIRESTORE_JOB_STATUS, 'VALIDATED');
  assert.equal(result.DRIVE_MATCHED_FILE_COUNT, 2);
  assert.equal(result.SHEET_EXACT_MATCHING_ROW_COUNT, 0);
  assert.equal(result.GMAIL_PROJECTION_MUTATION_FOUND, 'NO');
  assertTripwire(result);
});

test('candidate mismatch fails closed', async () => {
  const { result } = await runScenario({
    rediscovery: {
      status: 'BLOCKED_D7_E3G_CANDIDATE_FINGERPRINT_MISMATCH',
      summary: { CANDIDATE_FINGERPRINT_MATCH: 'NO' }
    }
  });
  assert.equal(result.STATUS, 'BLOCKED_READ_ONLY_FORENSICS_INCOMPLETE');
  assert.equal(result.PARTIAL_STATE, 'READ_ONLY_FORENSICS_INCOMPLETE');
  assert.equal(result.CANDIDATE_REDISCOVERY_STATUS, 'BLOCKED_D7_E3G_CANDIDATE_FINGERPRINT_MISMATCH');
  assertTripwire(result);
});

test('multiple candidates fails closed', async () => {
  const { result } = await runScenario({
    rediscovery: {
      status: 'BLOCKED_MULTIPLE_ELIGIBLE_CANDIDATES',
      summary: { ELIGIBLE_CANDIDATE_COUNT: 2 }
    }
  });
  assert.equal(result.STATUS, 'BLOCKED_READ_ONLY_FORENSICS_INCOMPLETE');
  assert.equal(result.CANDIDATE_REDISCOVERY_STATUS, 'BLOCKED_MULTIPLE_ELIGIBLE_CANDIDATES');
  assertTripwire(result);
});

test('Firestore unexpected state is classified separately', async () => {
  const { result } = await runScenario({ firestore: { FIRESTORE_JOB_STATUS: 'COMPLETED' } });
  assert.equal(result.STATUS, 'PASS_D7_E3G_READ_ONLY_DIAGNOSTIC_COMPLETE');
  assert.equal(result.PARTIAL_STATE, 'UNEXPECTED_FIRESTORE_STATE');
  assert.equal(result.BLOCKER, 'UNEXPECTED_FIRESTORE_STATE');
  assertTripwire(result);
});

test('Drive hash mismatch requires compensating action review', async () => {
  const { result } = await runScenario({
    drive: {
      DRIVE_XML_ACTUAL_SHA256: '0'.repeat(64),
      DRIVE_XML_HASH_MATCH: 'NO',
      DRIVE_XML_MATCHED_FILE_COUNT: 0,
      DRIVE_MATCHED_FILE_COUNT: 1,
      DRIVE_EXTRA_CONFLICT_FILE_COUNT: 1,
      DRIVE_DUPLICATE_STATUS: 'CONFLICTING_DRIVE_ARTIFACT',
      DRIVE_XML_CONFLICT_CLASSIFICATION: 'XML_CONFLICT_ACTUAL_DRIVE_BLOB_CONTENT_MISMATCH'
    }
  });
  assert.equal(result.PARTIAL_STATE, 'DRIVE_ARTIFACT_CONFLICT_REQUIRES_COMPENSATING_ACTION_REVIEW');
  assert.equal(result.DRIVE_XML_CONFLICT_CLASSIFICATION, 'XML_CONFLICT_ACTUAL_DRIVE_BLOB_CONTENT_MISMATCH');
  assertTripwire(result);
});

test('metadata hash mismatch while blob content is valid is classified', async () => {
  const { result } = await runScenario({
    drive: {
      DRIVE_XML_STORED_METADATA_HASH_MATCH: 'NO',
      STORED_XML_METADATA_HASH: '1'.repeat(64),
      DRIVE_XML_CONFLICT_CLASSIFICATION: 'XML_CONFLICT_STORED_METADATA_HASH_MISMATCH_BLOB_CONTENT_VALID'
    }
  });
  assert.equal(result.PARTIAL_STATE, 'DRIVE_ARTIFACTS_VALID_SHEET_ABSENT_FIRESTORE_RECONCILIATION_REQUIRED');
  assert.equal(result.DRIVE_XML_HASH_MATCH, 'YES');
  assert.equal(result.DRIVE_XML_CONFLICT_CLASSIFICATION, 'XML_CONFLICT_STORED_METADATA_HASH_MISMATCH_BLOB_CONTENT_VALID');
  assertTripwire(result);
});

test('duplicate Drive files block as ambiguity', async () => {
  const { result } = await runScenario({
    drive: {
      DRIVE_XML_CANDIDATE_COUNT: 2,
      DRIVE_XML_MATCHED_FILE_COUNT: 1,
      DRIVE_EXTRA_CONFLICT_FILE_COUNT: 1,
      DRIVE_DUPLICATE_STATUS: 'DUPLICATE_FILE_AMBIGUITY',
      DRIVE_XML_CONFLICT_CLASSIFICATION: 'XML_CONFLICT_DUPLICATE_FILE_AMBIGUITY'
    }
  });
  assert.equal(result.PARTIAL_STATE, 'DRIVE_ARTIFACT_CONFLICT_REQUIRES_COMPENSATING_ACTION_REVIEW');
  assert.equal(result.NEXT_SAFE_PHASE, 'D7_E3H_DRIVE_CONFLICT_COMPENSATING_ACTION_DESIGN');
  assertTripwire(result);
});

test('unexpected Sheet row or Gmail label classifies unexpected state', async () => {
  const sheetCase = await runScenario({ sheets: { SHEET_CANONICAL_MATCHING_ROW_COUNT: 1, SHEET_EXACT_MATCHING_ROW_COUNT: 1, SHEET_ROWS_CREATED_BY_D7_E_ATTEMPT: 1 } });
  assert.equal(sheetCase.result.PARTIAL_STATE, 'UNEXPECTED_SHEET_OR_GMAIL_STATE');
  assertTripwire(sheetCase.result);

  const gmailCase = await runScenario({ gmail: { GMAIL_COMPLETION_LABEL_PRESENT: 'YES', GMAIL_PROJECTION_MUTATION_FOUND: 'YES' } });
  assert.equal(gmailCase.result.PARTIAL_STATE, 'UNEXPECTED_SHEET_OR_GMAIL_STATE');
  assertTripwire(gmailCase.result);
});

test('before and after snapshot mismatch blocks concurrent change', async () => {
  const { result } = await runScenario({
    driveSequence: [
      {},
      { DRIVE_XML_MATCHED_FILE_COUNT: 0, DRIVE_MATCHED_FILE_COUNT: 1, DRIVE_XML_HASH_MATCH: 'NO' }
    ]
  });
  assert.equal(result.STATUS, 'BLOCKED_CONCURRENT_EXTERNAL_CHANGE_DURING_READ_ONLY_DIAGNOSTIC');
  assert.equal(result.PARTIAL_STATE, 'FORENSICS_UNSTABLE');
  assert.equal(result.CONCURRENT_EXTERNAL_CHANGE_DETECTED, 'YES');
  assertTripwire(result);
});

test('read permission blocker keeps forensics incomplete', async () => {
  const { result } = await runScenario({ drive: { DRIVE_READ_STATUS: 'READ_BLOCKED' } });
  assert.equal(result.STATUS, 'BLOCKED_READ_ONLY_FORENSICS_INCOMPLETE');
  assert.equal(result.PARTIAL_STATE, 'READ_ONLY_FORENSICS_INCOMPLETE');
  assert.equal(result.NEXT_SAFE_PHASE, 'NONE_UNTIL_READ_ACCESS_RESOLVED');
  assertTripwire(result);
});

test('sanitized logs contain no raw identifiers and counters stay zero', async () => {
  const bearer = ['Bear', 'er'].join('');
  const token = ['ya29', 'synthetic'].join('.');
  const email = ['operator', 'example.invalid'].join('@');
  const { result, logs } = await runScenario({
    rediscovery: { summary: { SAFE_NOTE: `${email} ${bearer} ${token}` } }
  });
  assert.equal(logs.length, 1);
  const text = logs.join('\n');
  assert.doesNotMatch(text, /operator@example\.invalid|Bearer ya29|raw-thread|raw-message|drive-file-id|spreadsheet-id/i);
  assert.match(text, /<email-redacted>/);
  assertTripwire(result);
});

test('helper validators reject unsafe Firestore paths and redact token-like strings', () => {
  const bearer = ['Bear', 'er'].join('');
  const token = ['ya29', 'secret'].join('.');
  const email = ['person', 'example.invalid'].join('@');
  assert.equal(gas.call('validateD7E3GFirestoreDocumentPath_', 'invoiceJobs/d7e_job_safe'), 'invoiceJobs/d7e_job_safe');
  assert.equal(gas.call('validateD7E3GFirestoreCollectionPath_', 'invoiceJobs/d7e_job_safe/events'), 'invoiceJobs/d7e_job_safe/events');
  assert.throws(() => gas.call('validateD7E3GFirestoreDocumentPath_', '../invoiceJobs/x'), /INVALID_FIRESTORE_DOCUMENT_PATH/);
  assert.throws(() => gas.call('validateD7E3GFirestoreDocumentPath_', 'users/u1'), /FIRESTORE_COLLECTION_NOT_ALLOWED/);
  assert.equal(gas.call('sanitizeD7E3GString_', `${bearer} ${token} ${email}`), 'OAUTH_TOKEN_REDACTED <email-redacted>');
});
