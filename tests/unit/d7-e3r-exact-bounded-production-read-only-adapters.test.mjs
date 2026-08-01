import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'D7_E3R_ExactBoundedProductionReadOnlyAdapters.js',
    'D7_E3I_ExactProductionConflictForensicAndSafeReconciliationPlan.js',
    'scripts/checkers/check-d7-e3r-exact-bounded-production-read-only-adapters.mjs',
    'docs/phases/D7_E3R_TO_U_EXACT_BOUNDED_PRODUCTION_READ_ONLY_ADAPTER_IMPLEMENTATION_SOURCE_SYNC_AND_FRESH_FORENSIC.md'
  ],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['D7_E3R_ExactBoundedProductionReadOnlyAdapters.js'],
  exportNames: [
    'D7_E3R_READER_IMPLEMENTATION_',
    'D7_E3R_FIRESTORE_PROJECT_ID_',
    'D7_E3R_FIRESTORE_DATABASE_ID_',
    'D7_E3R_FIRESTORE_MAX_READ_CALLS_',
    'createD7E3RExactBoundedProductionReadOnlyAdapters_',
    'validateD7E3RFirestoreDocumentPath_',
    'decodeD7E3RFirestoreDocument_'
  ]
});

const source = fs.readFileSync('D7_E3R_ExactBoundedProductionReadOnlyAdapters.js', 'utf8');
const e3iSource = fs.readFileSync('D7_E3I_ExactProductionConflictForensicAndSafeReconciliationPlan.js', 'utf8');
const fromVm = value => JSON.parse(JSON.stringify(value));
const sha = value => createHash('sha256').update(Buffer.from(Array.isArray(value) ? value : String(value), Array.isArray(value) ? undefined : 'utf8')).digest('hex');
const XML_BYTES = '<invoice><id>safe</id></invoice>';
const PDF_BYTES = '%PDF-safe';
const XML_SHA = sha(XML_BYTES);
const PDF_SHA = sha(PDF_BYTES);
const INVOICE_IDENTITY = sha('d7e3r-candidate');
const EXPECTED_DURABLE_IDENTITY = INVOICE_IDENTITY.slice(0, 8);
const JOB_ID = 'd7e_job_1234567890abcdef12345678';

function fakeContext(overrides = {}) {
  const row = {
    legacyHashIndex: 'legacy-hash-index-safe',
    invoiceKeyV2: 'invoice-key-safe',
    legacyInvoiceKey: 'invoice-key-safe',
    transactionIdentity: 'row-transaction-safe'
  };
  return {
    status: 'READ_OK',
    reasonCode: 'D7_E3R_CONTEXT_READY',
    properties: { D7_E3R_SHEET_ROW_NUMBER: '42' },
    config: {
      folderId: 'folder-safe',
      spreadsheetId: 'spreadsheet-safe',
      sheetName: 'Nhap-Xuat'
    },
    gmail: { messageCount: 1 },
    candidate: {
      xml: { fileName: 'invoice.xml', mimeType: 'application/xml', byteSize: XML_BYTES.length, sha256: XML_SHA, bytes: XML_BYTES },
      pdf: { fileName: 'invoice.pdf', mimeType: 'application/pdf', byteSize: PDF_BYTES.length, sha256: PDF_SHA, bytes: PDF_BYTES }
    },
    fingerprint: { summary: { CANDIDATE_FINGERPRINT: INVOICE_IDENTITY } },
    plan: {
      jobId: JOB_ID,
      invoiceIdentityHash: INVOICE_IDENTITY,
      commitPlan: { jobId: JOB_ID },
      driveTargets: {
        xml: { fileName: 'invoice.xml', folderReference: 'folder-safe', contentHash: XML_SHA, mimeType: 'application/xml' },
        pdf: { fileName: 'invoice.pdf', folderReference: 'folder-safe', contentHash: PDF_SHA, mimeType: 'application/pdf' }
      },
      attachmentRecords: [
        { attachmentId: 'att_xml_safe', artifactType: 'XML' },
        { attachmentId: 'att_pdf_safe', artifactType: 'PDF' }
      ]
    },
    ledgerRows: [row],
    identity: { executionIdentityStatus: 'MANUAL_OWNER_EXECUTION' },
    ...overrides
  };
}

function makeIterator(files) {
  let index = 0;
  return {
    hasNext: () => index < files.length,
    next: () => files[index++]
  };
}

function fakeDriveFile({ bytes, mime }) {
  return {
    getBlob: () => ({ getBytes: () => bytes, getContentType: () => mime }),
    getMimeType: () => mime,
    getSize: () => bytes.length
  };
}

function makeAdapters({ context = fakeContext(), driveFiles = {}, sheetRow, firestoreResponses = {}, token = 'safe-oauth-token' } = {}) {
  const calls = { driveNames: [], ranges: [], fetches: [], tokenCount: 0 };
  const adapters = gas.call('createD7E3RExactBoundedProductionReadOnlyAdapters_', {
    buildContext: () => context,
    driveGetFolderById: folderId => ({
      folderId,
      getFilesByName: name => {
        calls.driveNames.push(name);
        return makeIterator(driveFiles[name] || []);
      },
      getFiles: () => { throw new Error('BROAD_DRIVE_SCAN_FORBIDDEN'); }
    }),
    openSpreadsheetById: spreadsheetId => ({
      spreadsheetId,
      getSheetByName: name => ({
        name,
        getDataRange: () => { throw new Error('BROAD_SHEET_SCAN_FORBIDDEN'); },
        getRange: (row, column, height, width) => {
          calls.ranges.push({ row, column, height, width });
          const values = sheetRow || Array.from({ length: 16 }, () => '');
          return {
            getValues: () => [values],
            getDisplayValues: () => [values.map(String)],
            getFormulas: () => [Array.from({ length: width }, () => '')]
          };
        }
      })
    }),
    fetch: (url, params) => {
      calls.fetches.push({ url, params });
      const match = url.match(/\/documents\/(.+)$/);
      const decodedPath = match ? decodeURIComponent(match[1]).replace(/%2F/g, '/') : '';
      const response = firestoreResponses[decodedPath] || { status: 404, body: { error: { status: 'NOT_FOUND', message: 'not found' } } };
      return {
        getResponseCode: () => response.status,
        getContentText: () => JSON.stringify(response.body)
      };
    },
    getOAuthToken: () => {
      calls.tokenCount += 1;
      return token;
    },
    now: () => '2026-08-01T00:00:00.000Z'
  });
  return { adapters, calls };
}

function firestoreDoc(fields) {
  const encoded = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === null) encoded[key] = { nullValue: null };
    else if (typeof value === 'boolean') encoded[key] = { booleanValue: value };
    else if (typeof value === 'number') encoded[key] = Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    else if (Array.isArray(value)) encoded[key] = { arrayValue: { values: value.map(item => ({ mapValue: { fields: Object.fromEntries(Object.entries(item).map(([k, v]) => [k, { stringValue: String(v) }])) } })) } };
    else if (typeof value === 'object') encoded[key] = { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, { stringValue: String(v) }])) } };
    else encoded[key] = { stringValue: String(value) };
  }
  return { name: 'projects/p/databases/d/documents/safe/path', fields: encoded };
}

test('D7-E3R adapter metadata is read-only and bounded', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(gas.exports.D7_E3R_READER_IMPLEMENTATION_, 'REAL_BOUNDED_READ_ONLY');
  assert.equal(gas.exports.D7_E3R_FIRESTORE_PROJECT_ID_, 'tonkhohd');
  assert.equal(gas.exports.D7_E3R_FIRESTORE_DATABASE_ID_, '(default)');
  assert.equal(gas.exports.D7_E3R_FIRESTORE_MAX_READ_CALLS_, 5);
});

const D7_E3R_SCENARIOS = [
  ['01 factory exposes five read functions', () => {
    const { adapters } = makeAdapters();
    for (const key of ['readSnapshot', 'readGmailEvidence', 'readDriveEvidence', 'readSheetsEvidence', 'readFirestoreEvidence']) assert.equal(typeof adapters[key], 'function', key);
  }],
  ['02 D7-E3I production reader wiring is present', () => assert.match(e3iSource, /productionReaders\.readGmailEvidence/)],
  ['03 D7-E3I placeholder remains fallback only', () => assert.match(e3iSource, /productionReaders\.readFirestoreEvidence \|\| createD7E3IUnavailableSystemReader_/)],
  ['04 reader diagnostics are emitted by D7-E3I', () => assert.match(e3iSource, /READER_DIAGNOSTICS/)],
  ['05 no D7-E mutation entrypoint is called by adapter', () => assert.doesNotMatch(source, /runD7EOwnerApprovedOneCandidateProductionPilot\s*\(/)],
  ['06 no D6J mutation entrypoint is called by adapter', () => assert.doesNotMatch(source, /runD6jCOneRecordProductionMutation\s*\(/)],
  ['07 adapter has no Script Properties mutation', () => assert.doesNotMatch(source, /\.(setProperty|deleteProperty)\s*\(/)],
  ['08 adapter has no trigger mutation', () => assert.doesNotMatch(source, /ScriptApp\.(newTrigger|deleteTrigger)\s*\(/)],
  ['09 adapter has no Gmail mutation primitives', () => assert.doesNotMatch(source, /\.(addLabel|removeLabel|markRead|markUnread|moveToTrash)\s*\(/)],
  ['10 adapter has no Drive mutation primitives', () => assert.doesNotMatch(source, /\.(createFile|createFolder|setTrashed|setName|setContent)\s*\(/)],
  ['11 adapter has no Sheets mutation primitives', () => assert.doesNotMatch(source, /\.(appendRow|setValue|setValues|deleteRow|clear)\s*\(/)],
  ['12 adapter has no Firestore write HTTP methods', () => assert.doesNotMatch(source, /method:\s*['"`](post|put|patch|delete)['"`]/i)],
  ['13 Firestore transport uses GET only', () => assert.match(source, /method:\s*'get'/)],
  ['14 Firestore transport mutes HTTP exceptions', () => assert.match(source, /muteHttpExceptions:\s*true/)],
  ['15 Firestore reader validates document paths', () => assert.match(source, /validateD7E3RFirestoreDocumentPath_/)],
  ['16 Firestore reader has no collection query/list fallback', () => assert.doesNotMatch(source, /list(Collection|Documents)|runQuery|:runQuery|\/documents\?/)],
  ['17 Drive reader uses exact file names', () => assert.match(source, /getFilesByName\(target\.fileName\)/)],
  ['18 Drive reader does not use folder-wide getFiles', () => assert.doesNotMatch(source, /\.getFiles\s*\(/)],
  ['19 Sheets reader uses exact row A:P shape', () => assert.match(source, /getRange\(rowNumber,\s*1,\s*1,\s*width\)/)],
  ['20 Sheets reader does not use getDataRange', () => assert.doesNotMatch(source, /getDataRange\s*\(/)],
  ['21 bounded Gmail query requires attachment constraint', () => assert.match(source, /has:attachment/)],
  ['22 bounded Gmail search caps candidate reads at two for ambiguity proof', () => assert.match(source, /Math\.min\(2,\s*Number\(config\.maxResults/)],
  ['23 blocked readers keep REAL_BOUNDED marker', () => {
    const { adapters } = makeAdapters({ context: fakeContext({ status: 'READ_CONFIGURATION_INVALID', reasonCode: 'INVALID_EXACT_RESOURCE_REFERENCE' }) });
    assert.equal(fromVm(adapters.readGmailEvidence({})).readerImplementation, 'REAL_BOUNDED_READ_ONLY');
  }],
  ['24 snapshot captures hash prefixes only', () => {
    const { adapters } = makeAdapters();
    const snapshot = fromVm(adapters.readSnapshot({ stage: 'BEFORE' }));
    assert.equal(snapshot.status, 'SNAPSHOT_CAPTURED');
    assert.ok(snapshot.fingerprints.candidateFingerprintHashPrefix.length <= 16);
  }],
  ['25 Gmail reader returns exact counts and hashes', () => {
    const { adapters } = makeAdapters();
    const result = fromVm(adapters.readGmailEvidence({}));
    assert.equal(result.status, 'READ_OK');
    assert.equal(result.candidateCount, 1);
    assert.equal(result.xmlSha256, XML_SHA);
    assert.equal(result.pdfSha256, PDF_SHA);
  }],
  ['26 Drive XML exact match reads one exact file name', () => {
    const { adapters, calls } = makeAdapters({ driveFiles: { 'invoice.xml': [fakeDriveFile({ bytes: XML_BYTES, mime: 'application/xml' })] } });
    const result = fromVm(adapters.readDriveEvidence({ artifactType: 'XML' }));
    assert.equal(result.status, 'READ_OK');
    assert.deepEqual(calls.driveNames, ['invoice.xml']);
  }],
  ['27 Drive PDF exact match reads one exact file name', () => {
    const { adapters, calls } = makeAdapters({ driveFiles: { 'invoice.pdf': [fakeDriveFile({ bytes: PDF_BYTES, mime: 'application/pdf' })] } });
    const result = fromVm(adapters.readDriveEvidence({ artifactType: 'PDF' }));
    assert.equal(result.status, 'READ_OK');
    assert.deepEqual(calls.driveNames, ['invoice.pdf']);
  }],
  ['28 Drive missing file returns READ_NOT_FOUND', () => {
    const { adapters } = makeAdapters();
    assert.equal(fromVm(adapters.readDriveEvidence({ artifactType: 'XML' })).status, 'READ_NOT_FOUND');
  }],
  ['29 Drive duplicate ambiguity fails closed', () => {
    const duplicate = [fakeDriveFile({ bytes: XML_BYTES, mime: 'application/xml' }), fakeDriveFile({ bytes: XML_BYTES, mime: 'application/xml' })];
    const { adapters } = makeAdapters({ driveFiles: { 'invoice.xml': duplicate } });
    const result = fromVm(adapters.readDriveEvidence({ artifactType: 'XML' }));
    assert.equal(result.reasonCode, 'D7_E3R_DRIVE_DUPLICATE_AMBIGUITY');
  }],
  ['30 Drive content hash mismatch is document identity mismatch', () => {
    const { adapters } = makeAdapters({ driveFiles: { 'invoice.xml': [fakeDriveFile({ bytes: 'changed', mime: 'application/xml' })] } });
    assert.equal(fromVm(adapters.readDriveEvidence({ artifactType: 'XML' })).reasonCode, 'DOCUMENT_IDENTITY_MISMATCH');
  }],
  ['31 Drive MIME mismatch is document identity mismatch', () => {
    const { adapters } = makeAdapters({ driveFiles: { 'invoice.xml': [fakeDriveFile({ bytes: XML_BYTES, mime: 'text/plain' })] } });
    assert.equal(fromVm(adapters.readDriveEvidence({ artifactType: 'XML' })).reasonCode, 'DOCUMENT_IDENTITY_MISMATCH');
  }],
  ['32 Drive permission error is resource access denied', () => {
    const { adapters } = makeAdapters({ driveFiles: { 'invoice.xml': [{ getBlob: () => { throw new Error('permission denied'); } }] } });
    assert.equal(fromVm(adapters.readDriveEvidence({ artifactType: 'XML' })).reasonCode, 'RESOURCE_ACCESS_DENIED');
  }],
  ['33 Sheet exact row reads row 42 A:P three ways', () => {
    const row = Array.from({ length: 16 }, () => '');
    row[13] = 'legacy-hash-index-safe';
    row[14] = 'invoice-key-safe';
    const { adapters, calls } = makeAdapters({ sheetRow: row });
    const result = fromVm(adapters.readSheetsEvidence({}));
    assert.equal(result.exactTargetMatched, true);
    assert.deepEqual(calls.ranges, [{ row: 42, column: 1, height: 1, width: 16 }, { row: 42, column: 1, height: 1, width: 16 }, { row: 42, column: 1, height: 1, width: 16 }]);
  }],
  ['34 Sheet identity mismatch stays read-only conflict evidence', () => {
    const row = Array.from({ length: 16 }, () => '');
    row[13] = 'other-hash';
    row[14] = 'invoice-key-safe';
    const { adapters } = makeAdapters({ sheetRow: row });
    const result = fromVm(adapters.readSheetsEvidence({}));
    assert.equal(result.status, 'READ_OK');
    assert.equal(result.exactTargetMatched, false);
    assert.equal(result.hashIndexStatus, 'CONFLICT');
  }],
  ['35 missing sheet row configuration is invalid exact reference', () => {
    const context = fakeContext({ properties: {} });
    const { adapters } = makeAdapters({ context });
    assert.equal(fromVm(adapters.readSheetsEvidence({})).reasonCode, 'INVALID_EXACT_RESOURCE_REFERENCE');
  }],
  ['36 missing sheet is not found', () => {
    const context = fakeContext();
    const adapters = gas.call('createD7E3RExactBoundedProductionReadOnlyAdapters_', {
      buildContext: () => context,
      openSpreadsheetById: () => ({ getSheetByName: () => null })
    });
    assert.equal(fromVm(adapters.readSheetsEvidence({})).status, 'READ_NOT_FOUND');
  }],
  ['37 Firestore 200 decodes job, lease, attachments and report', () => {
    const responses = {
      [`invoiceJobs/${JOB_ID}`]: { status: 200, body: firestoreDoc({ status: 'COMPLETED', invoiceIdentityHash: EXPECTED_DURABLE_IDENTITY, version: 2, updatedAt: '2026-08-01T00:00:00Z', commitPlan: { jobId: JOB_ID }, auditEventCount: 2, latestReconciliationReportId: 'rpt_safe' }) },
      [`worker_leases/${JOB_ID}`]: { status: 200, body: firestoreDoc({ status: 'RELEASED' }) },
      'attachments/att_xml_safe': { status: 200, body: firestoreDoc({ artifactType: 'XML' }) },
      'attachments/att_pdf_safe': { status: 200, body: firestoreDoc({ artifactType: 'PDF' }) },
      [`invoiceJobs/${JOB_ID}/reconciliationReports/rpt_safe`]: { status: 200, body: firestoreDoc({ status: 'CONSISTENT', findings: [] }) }
    };
    const { adapters, calls } = makeAdapters({ firestoreResponses: responses });
    const result = fromVm(adapters.readFirestoreEvidence({}));
    assert.equal(result.status, 'READ_OK');
    assert.equal(result.jobIdentityStatus, 'MATCH');
    assert.equal(result.readCallCount, 5);
    assert.equal(calls.fetches.every(call => call.params.method === 'get' && call.params.muteHttpExceptions === true), true);
  }],
  ['38 Firestore 404s are safe absence evidence', () => {
    const { adapters } = makeAdapters();
    const result = fromVm(adapters.readFirestoreEvidence({}));
    assert.equal(result.status, 'READ_OK');
    assert.equal(result.jobExists, false);
    assert.equal(result.leaseStatus, 'NO_ACTIVE_LEASE_FOUND');
  }],
  ['39 Firestore 403 produces sanitized authorization diagnostics', () => {
    const token = 'safe-token-that-must-not-leak';
    const { adapters } = makeAdapters({ token, firestoreResponses: { [`invoiceJobs/${JOB_ID}`]: { status: 403, body: { error: { status: 'PERMISSION_DENIED', message: 'permission denied for safe path' } } } } });
    const result = fromVm(adapters.readFirestoreEvidence({}));
    assert.equal(result.reasonCode, 'FIRESTORE_AUTHORIZATION_FAILED');
    assert.equal(result.httpStatus, 403);
    assert.equal(JSON.stringify(result).includes(token), false);
  }],
  ['40 Firestore 500 is transport failed', () => {
    const { adapters } = makeAdapters({ firestoreResponses: { [`invoiceJobs/${JOB_ID}`]: { status: 500, body: { error: { status: 'INTERNAL', message: 'temporary' } } } } });
    assert.equal(fromVm(adapters.readFirestoreEvidence({})).reasonCode, 'TRANSPORT_FAILED');
  }],
  ['41 Firestore 429 is transport failed', () => {
    const { adapters } = makeAdapters({ firestoreResponses: { [`invoiceJobs/${JOB_ID}`]: { status: 429, body: { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } } } } });
    assert.equal(fromVm(adapters.readFirestoreEvidence({})).reasonCode, 'TRANSPORT_FAILED');
  }],
  ['42 Firestore invalid path rejects traversal', () => assert.throws(() => gas.call('validateD7E3RFirestoreDocumentPath_', '../bad'), /INVALID_EXACT_RESOURCE_REFERENCE/)],
  ['43 Firestore invalid collection rejects query roots', () => assert.throws(() => gas.call('validateD7E3RFirestoreDocumentPath_', 'collectionGroup/x'), /INVALID_EXACT_RESOURCE_REFERENCE/)],
  ['44 Firestore allows invoiceJobs exact doc', () => assert.equal(gas.call('validateD7E3RFirestoreDocumentPath_', `invoiceJobs/${JOB_ID}`), `invoiceJobs/${JOB_ID}`)],
  ['45 Firestore allows worker lease exact doc', () => assert.equal(gas.call('validateD7E3RFirestoreDocumentPath_', `worker_leases/${JOB_ID}`), `worker_leases/${JOB_ID}`)],
  ['46 Firestore allows attachment exact doc', () => assert.equal(gas.call('validateD7E3RFirestoreDocumentPath_', 'attachments/att_xml_safe'), 'attachments/att_xml_safe')],
  ['47 Firestore read count remains bounded at five', () => {
    const context = fakeContext({ plan: { ...fakeContext().plan, attachmentRecords: Array.from({ length: 9 }, (_, i) => ({ attachmentId: `att_${i}` })) } });
    const { adapters } = makeAdapters({ context });
    assert.equal(fromVm(adapters.readFirestoreEvidence({})).readCallCount, 5);
  }],
  ['48 decoded Firestore values preserve primitive fields', () => {
    const doc = fromVm(gas.call('decodeD7E3RFirestoreDocument_', firestoreDoc({ a: 'x', b: 2, c: true, d: null })));
    assert.deepEqual(doc, { a: 'x', b: 2, c: true, d: null });
  }],
  ['49 context build failure blocks Gmail without selecting another thread', () => {
    const { adapters } = makeAdapters({ context: fakeContext({ status: 'READ_CONFIGURATION_INVALID', reasonCode: 'D7_E3R_GMAIL_MULTIPLE_THREADS' }) });
    const result = fromVm(adapters.readGmailEvidence({}));
    assert.equal(result.reasonCode, 'D7_E3R_GMAIL_MULTIPLE_THREADS');
  }],
  ['50 context fingerprint mismatch blocks Drive before Drive read', () => {
    const { adapters, calls } = makeAdapters({ context: fakeContext({ status: 'READ_IDENTITY_MISMATCH', reasonCode: 'MESSAGE_IDENTITY_MISMATCH' }) });
    assert.equal(fromVm(adapters.readDriveEvidence({ artifactType: 'XML' })).reasonCode, 'MESSAGE_IDENTITY_MISMATCH');
    assert.deepEqual(calls.driveNames, []);
  }],
  ['51 all blocked channels still report zero mutation-capable APIs in source', () => assert.doesNotMatch(source, /LockService|CacheService|PropertiesService\.getScriptProperties\(\)\.(set|delete)/)],
  ['52 appsscript manifest already owns minimum scopes without cloud platform', () => {
    const manifest = fs.readFileSync('appsscript.json', 'utf8');
    assert.match(manifest, /https:\/\/mail\.google\.com\//);
    assert.match(manifest, /https:\/\/www\.googleapis\.com\/auth\/drive/);
    assert.match(manifest, /https:\/\/www\.googleapis\.com\/auth\/spreadsheets/);
    assert.match(manifest, /https:\/\/www\.googleapis\.com\/auth\/datastore/);
    assert.doesNotMatch(manifest, /cloud-platform/i);
  }],
  ['53 source has no raw known Gmail or Drive production identifiers', () => assert.doesNotMatch(source, /https:\/\/mail\.google\.com\/mail\/|https:\/\/drive\.google\.com\/|1[A-Za-z0-9_-]{20,}/)],
  ['54 scenario matrix itself proves required breadth', () => assert.equal(D7_E3R_SCENARIOS.length, 54)]
];

test('D7-E3R exact bounded production read-only adapter scenario matrix', () => {
  assert.equal(D7_E3R_SCENARIOS.length, 54);
  for (const [name, run] of D7_E3R_SCENARIOS) {
    assert.doesNotThrow(run, name);
  }
});
