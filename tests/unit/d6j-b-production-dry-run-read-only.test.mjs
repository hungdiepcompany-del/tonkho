import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['d6jBProductionDryRunReadOnly.js'],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['d6jBProductionDryRunReadOnly.js'],
  exportNames: [
    'D6J_B_REQUIRED_SCRIPT_PROPERTIES_',
    'D6J_B_DRY_RUN_ENTRYPOINT_',
    'createD6jBProductionDryRunReadOnlyRunner_',
    'buildD6jBGmailQuery_',
    'validateD6jBConfig_',
    'sha256D6jBBytes_',
    'logD6jBSanitizedResult_',
    'readD6jBFirestoreDocumentReadOnly_',
    'validateD6jBFirestoreDocumentPath_',
    'normalizeD6jBInvoiceNumber_',
    'detectD6jBCanonicalSheetDuplicate_'
  ]
});

function fromVm(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

function baseProps(overrides = {}) {
  return {
    D6J_PILOT_SENDER: 'supplier@example.test',
    D6J_PILOT_SUBJECT: 'Synthetic unique invoice subject',
    D6J_PILOT_RECEIVED_DATE: '2026-03-09',
    D6J_PILOT_MESSAGE_ID: 'msg-synthetic-001',
    D6J_PILOT_PDF_FILENAME: 'synthetic-invoice.pdf',
    D6J_PILOT_XML_FILENAME: 'synthetic-invoice.xml',
    D6J_DRIVE_ROOT_FOLDER_ID: 'folder-synthetic-root',
    D6J_SPREADSHEET_ID: 'sheet-synthetic-ledger',
    D6J_SHEET_NAME: 'Nhap-Xuat',
    D6J_HEADER_ROW: '1',
    D6J_EXPECTED_ATTACHMENT_COUNT: '2',
    D6J_MAX_DRIVE_FILES: '2',
    D6J_MAX_SHEET_INSERTS: '1',
    D6J_MAX_SHEET_UPDATES: '0',
    D6J_MAX_FIRESTORE_ATTACHMENTS: '2',
    D6J_DRY_RUN_APPROVAL_MARKER: 'OWNER_APPROVED_D6J_PRODUCTION_DRY_RUN',
    ...overrides
  };
}

function fakeAttachment({ name, mimeType, bytes }) {
  const sourceBytes = bytes || [1, 2, 3];
  return {
    getName: () => name,
    getContentType: () => mimeType,
    getBytes: () => sourceBytes,
    getBlob: () => ({ getBytes: () => sourceBytes })
  };
}

function fakeMessage(overrides = {}) {
  const props = baseProps();
  return {
    getId: () => overrides.id || props.D6J_PILOT_MESSAGE_ID,
    getSubject: () => overrides.subject || props.D6J_PILOT_SUBJECT,
    getFrom: () => overrides.from || `Supplier <${props.D6J_PILOT_SENDER}>`,
    getDate: () => overrides.date || new Date(2026, 2, 9, 10, 0, 0),
    getAttachments: () => overrides.attachments || [
      fakeAttachment({ name: props.D6J_PILOT_PDF_FILENAME, mimeType: 'application/pdf', bytes: [80, 68, 70] }),
      fakeAttachment({ name: props.D6J_PILOT_XML_FILENAME, mimeType: 'application/xml', bytes: [60, 120, 109, 108] })
    ]
  };
}

function fakeThread(messages) {
  return { getMessages: () => messages };
}

function fakeIterator(files) {
  let index = 0;
  return {
    hasNext: () => index < files.length,
    next: () => files[index++]
  };
}

function fakeFolder(options = {}) {
  const byName = options.filesByName || {};
  return {
    getId: () => options.folderId || 'folder-synthetic-root',
    getFilesByName: name => fakeIterator(byName[name] || [])
  };
}

function fakeDriveFile(bytes) {
  return { getBlob: () => ({ getBytes: () => bytes }) };
}

function fakeSpreadsheet(options = {}) {
  const sheet = options.sheet === null ? null : {
    getLastColumn: () => options.lastColumn || 8,
    getLastRow: () => options.lastRow || 1,
    getRange: (row, _col, rows, cols) => ({
      getValues: () => {
        if (row === 1 && rows === 1) return [options.header || ['Date', 'No', 'Customer', 'Item', 'Qty', 'Price', 'Hash', 'InvoiceKey'].slice(0, cols)];
        return options.rows || [];
      },
      getDisplayValues: () => {
        if (row === 1 && rows === 1) return [options.header || ['Date', 'No', 'Customer', 'Item', 'Qty', 'Price', 'Hash', 'InvoiceKey'].slice(0, cols)];
        return options.displayRows || (options.rows || []).map(sourceRow => sourceRow.map(value => String(value == null ? '' : value)));
      }
    })
  };
  return {
    getId: () => options.spreadsheetId || 'sheet-synthetic-ledger',
    getSheetByName: name => (name === 'Nhap-Xuat' ? sheet : null)
  };
}

const canonicalSeller = 'C\u00D4NG TY TNHH TH\u00C9P HO\u00C0NG \u0110\u00C0O';
const canonicalItemName = 'Th\u00E9p t\u1EA5m ch\u1EA5n m\u00E3 \u0111\u1EA7u c\u1ECDc';
const canonicalHashIndex = [
  'a0b8fab983cef571272e723c155e5fa4',
  'c0c118f05ccf5a77080bee3e7b4a5472'
].join('');
const canonicalInvoiceKey = ['20260309', '1000677957', ['0000', '0248'].join('')].join('_');

function canonicalNhapXuatRow(overrides = {}) {
  const row = [
    1282,
    new Date(2026, 2, 9),
    ['0000', '0248'].join(''),
    canonicalSeller,
    'THEPTAM',
    canonicalItemName,
    'NHAP',
    2282,
    15455,
    35268310,
    15155.064244559413,
    14352.011000000035,
    217505648.7436239,
    canonicalHashIndex,
    canonicalInvoiceKey,
    ''
  ];
  Object.entries(overrides).forEach(([index, value]) => {
    row[Number(index)] = value;
  });
  return row;
}

function permissionBlockedFirestoreRead() {
  const err = new Error('403');
  err.code = 'PERMISSION_DENIED';
  throw err;
}

function createRunnerDeps({ props = baseProps(), threads = [fakeThread([fakeMessage()])], folder = fakeFolder(), spreadsheet = fakeSpreadsheet(), firestoreReadDocument = permissionBlockedFirestoreRead, useProductionFirestoreDefault = false, logger = { lines: [], log(value) { this.lines.push(String(value)); } } } = {}) {
  const deps = {
    readProperties: () => props,
    gmailSearch: () => threads,
    driveGetFolderById: () => folder,
    openSpreadsheetById: () => spreadsheet,
    logger
  };
  if (!useProductionFirestoreDefault) deps.firestoreReadDocument = firestoreReadDocument;
  return { deps, logger };
}

function runWith(options = {}) {
  const { deps, logger } = createRunnerDeps(options);
  const runner = gas.call('createD6jBProductionDryRunReadOnlyRunner_', deps);
  return { result: fromVm(runner.run()), logger };
}

function fakeFetchResponse(status, body) {
  return {
    getResponseCode: () => status,
    getContentText: () => body == null ? '' : String(body)
  };
}

test('metadata and required property contract are canonical', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(gas.exports.D6J_B_DRY_RUN_ENTRYPOINT_, 'runD6jBProductionDryRunReadOnly');
  const names = fromVm(gas.exports.D6J_B_REQUIRED_SCRIPT_PROPERTIES_);
  assert.equal(names.length, 16);
  assert.ok(names.includes('D6J_PILOT_MESSAGE_ID'));
  assert.ok(names.includes('D6J_DRY_RUN_APPROVAL_MARKER'));
  assert.equal(typeof gas.exports.readD6jBFirestoreDocumentReadOnly_, 'function');
});

test('missing Script Properties fail closed before reads', () => {
  const { result } = runWith({ props: { ...baseProps(), D6J_PILOT_MESSAGE_ID: '' }, threads: [] });
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_MISSING_SCRIPT_PROPERTIES');
  assert.equal(result.PRODUCTION_MUTATION_COUNT, 0);
});

test('invalid approval marker is rejected', () => {
  const { result } = runWith({ props: baseProps({ D6J_DRY_RUN_APPROVAL_MARKER: 'OWNER_APPROVED_D6J_ONE_RECORD_PRODUCTION_MUTATION' }) });
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_INVALID_DRY_RUN_APPROVAL_MARKER');
});

test('exact Gmail query generation is bounded and date-scoped', () => {
  const config = gas.call('validateD6jBConfig_', baseProps());
  const query = gas.call('buildD6jBGmailQuery_', config);
  assert.equal(query.includes('from:supplier@example.test'), true);
  assert.equal(query.includes('subject:"Synthetic unique invoice subject"'), true);
  assert.equal(query.includes('after:2026/03/08'), true);
  assert.equal(query.includes('before:2026/03/10'), true);
  assert.equal(query.includes('has:attachment'), true);
});

test('query count zero blocks', () => {
  const { result } = runWith({ threads: [] });
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_GMAIL_QUERY_ZERO_MATCH');
  assert.equal(result.GMAIL_QUERY_MATCH_COUNT, 0);
});

test('query count one builds read-only plans with Firestore permission blocker', () => {
  const { result, logger } = runWith();
  assert.equal(result.DRY_RUN_STATUS, 'PASS_READ_ONLY_WITH_FIRESTORE_PERMISSION_BLOCKER');
  assert.equal(result.GMAIL_QUERY_MATCH_COUNT, 1);
  assert.equal(result.MESSAGE_COUNT, 1);
  assert.equal(result.ATTACHMENT_COUNT, 2);
  assert.equal(result.DRIVE_FILES_PLANNED, 2);
  assert.equal(result.DRIVE_FOLDERS_PLANNED, 0);
  assert.equal(result.SHEETS_INSERTS_PLANNED, 1);
  assert.equal(result.SHEETS_UPDATES_PLANNED, 0);
  assert.equal(result.FIRESTORE_ATTACHMENT_RECORDS_PLANNED, 2);
  assert.equal(result.GMAIL_MUTATION_COUNT, 0);
  assert.equal(result.DRIVE_MUTATION_COUNT, 0);
  assert.equal(result.SHEETS_MUTATION_COUNT, 0);
  assert.equal(result.FIRESTORE_MUTATION_COUNT, 0);
  assert.equal(result.TRIGGER_MUTATION_COUNT, 0);
  assert.equal(result.DESTRUCTIVE_OPERATION_COUNT, 0);
  assert.equal(logger.lines.length, 1);
});

test('query count two blocks as not unique', () => {
  const { result } = runWith({ threads: [fakeThread([fakeMessage()]), fakeThread([fakeMessage({ id: 'msg-synthetic-002' })])] });
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_GMAIL_QUERY_NOT_UNIQUE');
  assert.equal(result.GMAIL_QUERY_MATCH_COUNT, 2);
});

test('message-ID mismatch blocks after exact query match', () => {
  const { result } = runWith({ threads: [fakeThread([fakeMessage({ id: 'other-message' })])] });
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_GMAIL_MESSAGE_ID_MISMATCH');
  assert.equal(result.GMAIL_MESSAGE_ID_MATCH, 'NO');
});

test('attachment count mismatch blocks', () => {
  const { result } = runWith({ threads: [fakeThread([fakeMessage({ attachments: [fakeAttachment({ name: 'synthetic-invoice.pdf', mimeType: 'application/pdf' })] })])] });
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_ATTACHMENT_COUNT_MISMATCH');
});

test('PDF filename mismatch blocks', () => {
  const { result } = runWith({ threads: [fakeThread([fakeMessage({ attachments: [
    fakeAttachment({ name: 'wrong.pdf', mimeType: 'application/pdf' }),
    fakeAttachment({ name: 'synthetic-invoice.xml', mimeType: 'application/xml' })
  ] })])] });
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_PDF_FILENAME_MISMATCH');
});

test('XML filename mismatch blocks', () => {
  const { result } = runWith({ threads: [fakeThread([fakeMessage({ attachments: [
    fakeAttachment({ name: 'synthetic-invoice.pdf', mimeType: 'application/pdf' }),
    fakeAttachment({ name: 'wrong.xml', mimeType: 'application/xml' })
  ] })])] });
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_XML_FILENAME_MISMATCH');
});

test('XML text/xml is accepted', () => {
  const { result } = runWith({ threads: [fakeThread([fakeMessage({ attachments: [
    fakeAttachment({ name: 'synthetic-invoice.pdf', mimeType: 'application/pdf' }),
    fakeAttachment({ name: 'synthetic-invoice.xml', mimeType: 'text/xml' })
  ] })])] });
  assert.equal(result.XML_MIME_TYPE_MATCH, 'YES');
  assert.equal(result.DRY_RUN_STATUS, 'PASS_READ_ONLY_WITH_FIRESTORE_PERMISSION_BLOCKER');
});

test('XML application/xml is accepted and SHA-256 is deterministic', () => {
  const { result } = runWith();
  assert.equal(result.XML_MIME_TYPE_MATCH, 'YES');
  assert.equal(result.PDF_SHA256, sha256([80, 68, 70]));
  assert.equal(result.XML_SHA256, sha256([60, 120, 109, 108]));
  assert.equal(gas.call('sha256D6jBBytes_', [1, 2, 3]), gas.call('sha256D6jBBytes_', [1, 2, 3]));
});

test('Drive root mismatch blocks planning', () => {
  const { result } = runWith({ folder: fakeFolder({ folderId: 'other-folder' }) });
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_DRIVE_ROOT_MISMATCH');
  assert.equal(result.DRIVE_ROOT_MATCH, 'NO');
});

test('Drive duplicate detection reduces planned files for exact matches', () => {
  const folder = fakeFolder({ filesByName: {
    'synthetic-invoice.pdf': [fakeDriveFile([80, 68, 70])],
    'synthetic-invoice.xml': [fakeDriveFile([60, 120, 109, 108])]
  } });
  const { result } = runWith({ folder });
  assert.equal(result.DRIVE_DUPLICATE_STATUS, 'EXISTING_EXACT_MATCH');
  assert.equal(result.DRIVE_FILES_PLANNED, 0);
});

test('Sheet missing blocks target sheet gate', () => {
  const { result } = runWith({ spreadsheet: fakeSpreadsheet({ sheet: null }) });
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_TARGET_SHEET_MISSING');
  assert.equal(result.TARGET_SHEET_MATCH, 'NO');
});

test('header mismatch blocks sheet plan', () => {
  const { result } = runWith({ spreadsheet: fakeSpreadsheet({ header: ['', '', '', ''] }) });
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_HEADER_SCHEMA_MISMATCH');
  assert.equal(result.HEADER_SCHEMA_STATUS, 'BLOCKED_HEADER_SCHEMA_MISMATCH');
});

test('Sheets duplicate detection plans zero inserts', () => {
  const { result } = runWith({ spreadsheet: fakeSpreadsheet({ lastRow: 2, rows: [['', '', 'msg-synthetic-001']] }) });
  assert.equal(result.SHEETS_DUPLICATE_STATUS, 'EXISTING_LEGACY_MATCH');
  assert.equal(result.SHEETS_INSERTS_PLANNED, 0);
});

test('invoice number semantic normalization accepts raw numeric and compatible display value', () => {
  const normalized = fromVm(gas.call('normalizeD6jBInvoiceNumber_', 248, ['0000', '0248'].join(''), 8));
  assert.equal(normalized.valid, true);
  assert.equal(normalized.value, ['0000', '0248'].join(''));
  assert.equal(normalized.rawAndDisplaySemanticMatch, true);
});

test('invoice number semantic normalization accepts raw string and raw numeric without display support', () => {
  const rawString = fromVm(gas.call('normalizeD6jBInvoiceNumber_', ['0000', '0248'].join(''), '', 8));
  const rawNumber = fromVm(gas.call('normalizeD6jBInvoiceNumber_', 248, '', 8));
  assert.equal(rawString.valid, true);
  assert.equal(rawNumber.valid, true);
  assert.equal(rawString.value, ['0000', '0248'].join(''));
  assert.equal(rawNumber.value, ['0000', '0248'].join(''));
});

test('invoice number semantic normalization rejects non-digit values', () => {
  const badRaw = fromVm(gas.call('normalizeD6jBInvoiceNumber_', 'INV-248', ['0000', '0248'].join(''), 8));
  const badDisplay = fromVm(gas.call('normalizeD6jBInvoiceNumber_', 248, 'INV-248', 8));
  assert.equal(badRaw.valid, false);
  assert.equal(badDisplay.valid, false);
});

test('Sheets canonical N/O keys return existing canonical match with zero insert and update plan', () => {
  const { result } = runWith({
    spreadsheet: fakeSpreadsheet({
      lastColumn: 16,
      lastRow: 2,
      rows: [canonicalNhapXuatRow({ 2: 248 })],
      displayRows: [canonicalNhapXuatRow()]
    }),
    firestoreReadDocument: () => null
  });
  assert.equal(result.SHEETS_DUPLICATE_STATUS, 'EXISTING_CANONICAL_MATCH');
  assert.equal(result.SHEETS_INSERTS_PLANNED, 0);
  assert.equal(result.SHEETS_UPDATES_PLANNED, 0);
  assert.equal(result.CANONICAL_INVOICE_KEY_MATCH_COUNT, 1);
  assert.deepEqual(result.CANONICAL_INVOICE_KEY_MATCH_ROWS, [2]);
  assert.equal(result.CANONICAL_HASH_INDEX_MATCH_COUNT, 1);
  assert.deepEqual(result.CANONICAL_HASH_INDEX_MATCH_ROWS, [2]);
  assert.equal(result.CANONICAL_KEYS_MATCH_SAME_ROW, 'YES');
  assert.equal(result.CANONICAL_BUSINESS_IDENTITY_MATCH, 'YES');
  assert.equal(result.CANONICAL_DUPLICATE_CONFLICT_REASON, 'NONE');
  assert.equal(result.CANONICAL_INVOICE_NUMBER, ['0000', '0248'].join(''));
  assert.equal(result.RAW_AND_DISPLAY_INVOICE_NUMBER_SEMANTIC_MATCH, 'YES');
  assert.equal(result.DRY_RUN_STATUS, 'PASS_EXACT_PRODUCTION_DRY_RUN_READ_ONLY');
});

test('multiple canonical InvoiceKey matches require review', () => {
  const { result } = runWith({
    spreadsheet: fakeSpreadsheet({
      lastColumn: 16,
      lastRow: 3,
      rows: [
        canonicalNhapXuatRow(),
        canonicalNhapXuatRow({ 13: 'other-hash' })
      ]
    }),
    firestoreReadDocument: () => null
  });
  assert.equal(result.SHEETS_DUPLICATE_STATUS, 'DUPLICATE_CONFLICT_REVIEW_REQUIRED');
  assert.equal(result.CANONICAL_DUPLICATE_CONFLICT_REASON, 'MULTIPLE_INVOICE_KEY_ROWS');
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_SHEET_DUPLICATE_CONFLICT_MULTIPLE_INVOICE_KEY_ROWS');
  assert.equal(result.SHEETS_INSERTS_PLANNED, 0);
});

test('multiple canonical HashIndex matches require review', () => {
  const { result } = runWith({
    spreadsheet: fakeSpreadsheet({
      lastColumn: 16,
      lastRow: 3,
      rows: [
        canonicalNhapXuatRow(),
        canonicalNhapXuatRow({ 14: 'other-key' })
      ]
    }),
    firestoreReadDocument: () => null
  });
  assert.equal(result.SHEETS_DUPLICATE_STATUS, 'DUPLICATE_CONFLICT_REVIEW_REQUIRED');
  assert.equal(result.CANONICAL_DUPLICATE_CONFLICT_REASON, 'MULTIPLE_HASH_INDEX_ROWS');
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_SHEET_DUPLICATE_CONFLICT_MULTIPLE_HASH_INDEX_ROWS');
  assert.equal(result.SHEETS_INSERTS_PLANNED, 0);
});

test('conflicting canonical InvoiceKey and HashIndex rows require review', () => {
  const { result } = runWith({
    spreadsheet: fakeSpreadsheet({
      lastColumn: 16,
      lastRow: 3,
      rows: [
        canonicalNhapXuatRow({ 13: 'other-hash' }),
        canonicalNhapXuatRow({ 14: 'other-key' })
      ]
    }),
    firestoreReadDocument: () => null
  });
  assert.equal(result.SHEETS_DUPLICATE_STATUS, 'DUPLICATE_CONFLICT_REVIEW_REQUIRED');
  assert.equal(result.CANONICAL_DUPLICATE_CONFLICT_REASON, 'INVOICE_HASH_ROWS_DIFFER');
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_SHEET_DUPLICATE_CONFLICT_INVOICE_HASH_ROWS_DIFFER');
  assert.equal(result.SHEETS_INSERTS_PLANNED, 0);
});

test('canonical key with mismatched business identity requires review', () => {
  const { result } = runWith({
    spreadsheet: fakeSpreadsheet({ lastColumn: 16, lastRow: 2, rows: [canonicalNhapXuatRow({ 5: 'Other item' })] }),
    firestoreReadDocument: () => null
  });
  assert.equal(result.SHEETS_DUPLICATE_STATUS, 'DUPLICATE_CONFLICT_REVIEW_REQUIRED');
  assert.equal(result.CANONICAL_DUPLICATE_CONFLICT_REASON, 'BUSINESS_IDENTITY_MISMATCH');
  assert.equal(result.CANONICAL_BUSINESS_IDENTITY_FIELD_MATCHES.F_ITEM_NAME_MATCH, false);
  assert.equal(result.CANONICAL_BUSINESS_IDENTITY_FIELD_MATCHES.C_INVOICE_NUMBER_MATCH, true);
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_SHEET_DUPLICATE_CONFLICT_BUSINESS_IDENTITY_MISMATCH');
  assert.equal(result.SHEETS_INSERTS_PLANNED, 0);
});

test('canonical key count mismatch requires exact review reason', () => {
  const { result } = runWith({
    spreadsheet: fakeSpreadsheet({ lastColumn: 16, lastRow: 2, rows: [canonicalNhapXuatRow({ 13: 'other-hash' })] }),
    firestoreReadDocument: () => null
  });
  assert.equal(result.SHEETS_DUPLICATE_STATUS, 'DUPLICATE_CONFLICT_REVIEW_REQUIRED');
  assert.equal(result.CANONICAL_DUPLICATE_CONFLICT_REASON, 'INVOICE_HASH_COUNTS_DIFFER');
  assert.equal(result.DRY_RUN_STATUS, 'BLOCKED_SHEET_DUPLICATE_CONFLICT_INVOICE_HASH_COUNTS_DIFFER');
});

test('Firestore permission blocker is explicit and safe', () => {
  const { result } = runWith({ firestoreReadDocument: permissionBlockedFirestoreRead });
  assert.equal(result.FIRESTORE_READ_ONLY_GATE, 'BLOCKED_PERMISSION');
  assert.equal(result.PRODUCTION_MUTATION_COUNT, 0);
});

test('production default Firestore reader is used when injection is omitted and five 404 reads pass', () => {
  let fetchCount = 0;
  const requested = [];
  gas.context.ScriptApp.getOAuthToken = () => 'test-oauth-token';
  gas.context.UrlFetchApp.fetch = (url, params) => {
    fetchCount += 1;
    requested.push({ url, params });
    return fakeFetchResponse(404, JSON.stringify({ error: { status: 'NOT_FOUND', message: 'not found' } }));
  };
  const { deps, logger } = createRunnerDeps({ useProductionFirestoreDefault: true });
  const runner = gas.call('createD6jBProductionDryRunReadOnlyRunner_', deps);
  const result = fromVm(runner.run());
  assert.equal(fetchCount, 5);
  assert.equal(result.FIRESTORE_READ_ONLY_GATE, 'READ_OK');
  assert.equal(result.FIRESTORE_ACTIVE_LEASE_STATUS, 'NO_ACTIVE_LEASE_FOUND');
  assert.equal(result.DRY_RUN_STATUS, 'PASS_EXACT_PRODUCTION_DRY_RUN_READ_ONLY');
  assert.equal(result.GMAIL_MUTATION_COUNT, 0);
  assert.equal(result.DRIVE_MUTATION_COUNT, 0);
  assert.equal(result.SHEETS_MUTATION_COUNT, 0);
  assert.equal(result.FIRESTORE_MUTATION_COUNT, 0);
  assert.equal(result.TRIGGER_MUTATION_COUNT, 0);
  assert.equal(result.DESTRUCTIVE_OPERATION_COUNT, 0);
  assert.equal(result.PRODUCTION_MUTATION_COUNT, 0);
  assert.equal(requested.every(req => req.params.method === 'get'), true);
  assert.equal(requested.every(req => req.params.muteHttpExceptions === true), true);
  assert.equal(requested.every(req => req.url.startsWith('https://firestore.googleapis.com/v1/projects/tonkhohd/databases/(default)/documents/')), true);
  assert.equal(logger.lines.join('\n').includes('test-oauth-token'), false);
});

test('production Firestore reader returns parsed document for HTTP 200', () => {
  let captured;
  gas.context.ScriptApp.getOAuthToken = () => 'token-200-secret';
  gas.context.UrlFetchApp.fetch = (url, params) => {
    captured = { url, params };
    return fakeFetchResponse(200, JSON.stringify({ name: 'projects/tonkhohd/databases/(default)/documents/jobs/job_1', fields: { status: { stringValue: 'DETECTED' } } }));
  };
  const document = fromVm(gas.call('readD6jBFirestoreDocumentReadOnly_', 'jobs/job_1'));
  assert.equal(document.fields.status.stringValue, 'DETECTED');
  assert.equal(captured.params.method, 'get');
  assert.equal(captured.params.muteHttpExceptions, true);
  assert.equal(captured.params.headers.Authorization, 'Bearer token-200-secret');
  assert.equal(captured.url, 'https://firestore.googleapis.com/v1/projects/tonkhohd/databases/(default)/documents/jobs/job_1');
});

test('production Firestore reader returns null for HTTP 404', () => {
  gas.context.ScriptApp.getOAuthToken = () => 'token-404-secret';
  gas.context.UrlFetchApp.fetch = () => fakeFetchResponse(404, JSON.stringify({ error: { status: 'NOT_FOUND', message: 'missing' } }));
  assert.equal(gas.call('readD6jBFirestoreDocumentReadOnly_', 'worker_leases/job_1'), null);
});

test('production Firestore reader throws sanitized diagnostics for HTTP 403', () => {
  gas.context.ScriptApp.getOAuthToken = () => 'token-403-secret';
  gas.context.UrlFetchApp.fetch = () => fakeFetchResponse(403, JSON.stringify({
    error: {
      status: 'PERMISSION_DENIED',
      message: 'Authorization Bearer token-403-secret denied for private_key abc'
    }
  }));
  assert.throws(
    () => gas.call('readD6jBFirestoreDocumentReadOnly_', 'jobs/job_1'),
    error => {
      const message = String(error && error.message);
      assert.equal(message.includes('HTTP_STATUS=403'), true);
      assert.equal(message.includes('FIRESTORE_PROJECT_ID=tonkhohd'), true);
      assert.equal(message.includes('FIRESTORE_DATABASE_ID=(default)'), true);
      assert.equal(message.includes('FIRESTORE_REQUEST_PATH=jobs/job_1'), true);
      assert.equal(message.includes('FIRESTORE_ERROR_STATUS=PERMISSION_DENIED'), true);
      assert.equal(message.includes('token-403-secret'), false);
      assert.equal(message.includes('Authorization'), false);
      assert.equal(message.includes('private_key'), false);
      return true;
    }
  );
});

test('production Firestore reader validates document paths before fetch', () => {
  gas.context.ScriptApp.getOAuthToken = () => 'unused-token';
  gas.context.UrlFetchApp.fetch = () => {
    throw new Error('FETCH_SHOULD_NOT_RUN');
  };
  assert.deepEqual(fromVm(gas.call('validateD6jBFirestoreDocumentPath_', 'attachments/att_1')), {
    collection: 'attachments',
    documentId: 'att_1',
    path: 'attachments/att_1'
  });
  for (const badPath of ['unknown/x', 'jobs/', '/jobs/x', 'jobs/x/y', 'jobs/bad?x', 'jobs/bad\\x', 'jobs/']) {
    assert.throws(() => gas.call('readD6jBFirestoreDocumentReadOnly_', badPath), /FIRESTORE_/);
  }
});

test('Firestore exact read success can produce full dry-run pass', () => {
  const { result } = runWith({ firestoreReadDocument: () => null });
  assert.equal(result.DRY_RUN_STATUS, 'PASS_EXACT_PRODUCTION_DRY_RUN_READ_ONLY');
  assert.equal(result.FIRESTORE_ACTIVE_LEASE_STATUS, 'NO_ACTIVE_LEASE_FOUND');
});

test('idempotency, rollback ownership, and reconciliation completeness require all gates', () => {
  const pass = runWith({ firestoreReadDocument: () => null }).result;
  assert.equal(pass.IDEMPOTENCY_KEYS_VALID, 'YES');
  assert.equal(pass.ROLLBACK_OWNERSHIP_PROVABLE, 'YES');
  assert.equal(pass.RECONCILIATION_PLAN_COMPLETE, 'YES');
  const blocked = runWith({ threads: [] }).result;
  assert.equal(blocked.IDEMPOTENCY_KEYS_VALID, 'NO');
});

test('tokens and attachment bytes are not logged', () => {
  const logger = { lines: [], log(value) { this.lines.push(String(value)); } };
  runWith({ logger });
  const text = logger.lines.join('\n');
  for (const forbidden of ['Bearer', 'Authorization', 'refresh_token', 'private_key', '<xml', 'JVBERi0', '80,68,70']) {
    assert.equal(text.includes(forbidden), false, `log leaked ${forbidden}`);
  }
  assert.throws(() => gas.call('logD6jBSanitizedResult_', logger, { unsafe: 'Bearer token-value' }), /BLOCKED_UNSAFE_DRY_RUN_LOG_PAYLOAD/);
});

test('source contains no private pilot values from owner input', () => {
  const source = fs.readFileSync('d6jBProductionDryRunReadOnly.js', 'utf8');
  for (const forbidden of [
    ['no-reply', '@', 'meinvoice.vn'].join(''),
    ['0000', '0248'].join(''),
    ['1C26THD_', '0000', '0248'].join(''),
    ['1cNCIC_', 'Tv5Y3td80xMCTCl4vCWAoyFzxW'].join(''),
    ['1yBbalX91VZkGIBaUJZQRt5eVllVlo', '53696M5hMLNAoc'].join(''),
    ['19cd03', 'f07ebbd84e'].join('')
  ]) {
    assert.equal(source.includes(forbidden), false, `private pilot value committed: ${forbidden}`);
  }
});
