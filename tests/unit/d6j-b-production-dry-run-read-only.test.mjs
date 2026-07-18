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
    'logD6jBSanitizedResult_'
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
      }
    })
  };
  return {
    getId: () => options.spreadsheetId || 'sheet-synthetic-ledger',
    getSheetByName: name => (name === 'Nhap-Xuat' ? sheet : null)
  };
}

function runWith({ props = baseProps(), threads = [fakeThread([fakeMessage()])], folder = fakeFolder(), spreadsheet = fakeSpreadsheet(), firestoreReadDocument = null, logger = { lines: [], log(value) { this.lines.push(String(value)); } } } = {}) {
  const runner = gas.call('createD6jBProductionDryRunReadOnlyRunner_', {
    readProperties: () => props,
    gmailSearch: () => threads,
    driveGetFolderById: () => folder,
    openSpreadsheetById: () => spreadsheet,
    firestoreReadDocument,
    logger
  });
  return { result: fromVm(runner.run()), logger };
}

test('metadata and required property contract are canonical', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(gas.exports.D6J_B_DRY_RUN_ENTRYPOINT_, 'runD6jBProductionDryRunReadOnly');
  const names = fromVm(gas.exports.D6J_B_REQUIRED_SCRIPT_PROPERTIES_);
  assert.equal(names.length, 16);
  assert.ok(names.includes('D6J_PILOT_MESSAGE_ID'));
  assert.ok(names.includes('D6J_DRY_RUN_APPROVAL_MARKER'));
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
  assert.equal(result.SHEETS_DUPLICATE_STATUS, 'EXISTING_MATCH');
  assert.equal(result.SHEETS_INSERTS_PLANNED, 0);
});

test('Firestore permission blocker is explicit and safe', () => {
  const { result } = runWith({ firestoreReadDocument: () => { const err = new Error('403'); err.code = 'PERMISSION_DENIED'; throw err; } });
  assert.equal(result.FIRESTORE_READ_ONLY_GATE, 'BLOCKED_PERMISSION');
  assert.equal(result.PRODUCTION_MUTATION_COUNT, 0);
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
