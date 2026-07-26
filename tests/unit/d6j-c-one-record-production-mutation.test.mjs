import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import { createFakeFirestoreTransport } from '../../fixtures/sgds-crit-003-d2/firestore-adapter-fixtures.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'd6jCOneRecordProductionMutation.js',
    'd6jBProductionDryRunReadOnly.js',
    'firestoreDurableJobStore.js',
    'sgdsDriveAdapter.js',
    'sgdsSheetsLedgerAdapter.js'
  ],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: [
    'sgdsAdapterErrors.js',
    'sgdsGmailAdapter.js',
    'sgdsDriveAdapter.js',
    'sgdsSheetsLedgerAdapter.js',
    'durableJobState.js',
    'firestoreDataContract.js',
    'firestoreRestGateway.js',
    'firestoreDurableJobStore.js',
    'd6jBProductionDryRunReadOnly.js',
    'd6jCOneRecordProductionMutation.js'
  ],
  exportNames: [
    'D6J_C_MUTATION_ENTRYPOINT_',
    'D6J_C_MUTATION_SCHEMA_VERSION_',
    'D6J_C_MUTATION_APPROVAL_',
    'D6J_C_MUTATION_APPROVAL_PROPERTY_',
    'createD6jCOneRecordProductionMutationRunner_',
    'createFakeSgdsDriveAdapter_',
    'createFakeSgdsSheetsLedgerAdapter_',
    'buildSgdsDriveArtifactIdentity_',
    'createDurableInvoiceJobStore',
    'hashPrefixD6jC_',
    'logD6jCSanitizedResult_'
  ]
});

const fromVm = value => JSON.parse(JSON.stringify(value));

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
    D6J_C_MUTATION_APPROVAL_MARKER: 'OWNER_APPROVED_D6J_C_ONE_RECORD_PRODUCTION_MUTATION',
    ...overrides
  };
}

function passPreflight(overrides = {}) {
  return {
    DRY_RUN_STATUS: 'PASS_EXACT_PRODUCTION_DRY_RUN_READ_ONLY',
    PILOT_ID: 'd6j_pilot_synthetic',
    CORRELATION_ID: 'd6j_corr_synthetic',
    GMAIL_QUERY_MATCH_COUNT: 1,
    MESSAGE_COUNT: 1,
    GMAIL_MESSAGE_ID: 'msg-synthetic-001',
    GMAIL_MESSAGE_ID_MATCH: 'YES',
    ATTACHMENT_COUNT: 2,
    PDF_FILENAME_MATCH: 'YES',
    PDF_MIME_TYPE_MATCH: 'YES',
    PDF_SIZE_BYTES: 3,
    PDF_SHA256: 'pdfhash',
    XML_FILENAME_MATCH: 'YES',
    XML_MIME_TYPE_MATCH: 'YES',
    XML_SIZE_BYTES: 4,
    XML_SHA256: 'xmlhash',
    DRIVE_ROOT_MATCH: 'YES',
    DRIVE_FILES_PLANNED: 2,
    DRIVE_FOLDERS_PLANNED: 0,
    SPREADSHEET_ID_MATCH: 'YES',
    TARGET_SHEET_MATCH: 'YES',
    HEADER_ROW_MATCH: 'YES',
    HEADER_SCHEMA_STATUS: 'PASS',
    SHEETS_INSERTS_PLANNED: 1,
    SHEETS_UPDATES_PLANNED: 0,
    FIRESTORE_JOBS_PLANNED: 1,
    FIRESTORE_ATTACHMENT_RECORDS_PLANNED: 2,
    FIRESTORE_READ_ONLY_GATE: 'READ_OK',
    FIRESTORE_ACTIVE_LEASE_STATUS: 'NO_ACTIVE_LEASE_FOUND',
    IDEMPOTENCY_KEYS_VALID: 'YES',
    ROLLBACK_OWNERSHIP_PROVABLE: 'YES',
    RECONCILIATION_PLAN_COMPLETE: 'YES',
    GMAIL_MUTATION_COUNT: 0,
    DRIVE_MUTATION_COUNT: 0,
    SHEETS_MUTATION_COUNT: 0,
    FIRESTORE_MUTATION_COUNT: 0,
    TRIGGER_MUTATION_COUNT: 0,
    DESTRUCTIVE_OPERATION_COUNT: 0,
    PRODUCTION_MUTATION_COUNT: 0,
    ...overrides
  };
}

function artifacts() {
  return {
    threadIdHash: 'threadhash',
    messageId: 'msg-synthetic-001',
    pdf: { fileName: 'synthetic-invoice.pdf', mimeType: 'application/pdf', bytes: [1, 2, 3], byteSize: 3, contentHash: 'pdfhash' },
    xml: { fileName: 'synthetic-invoice.xml', mimeType: 'application/xml', bytes: [4, 5, 6, 7], byteSize: 4, contentHash: 'xmlhash' }
  };
}

function ledgerRow(overrides = {}) {
  return {
    issueDate: '2026-03-09',
    legacyInvoiceKey: 'SYNTHETIC_LEGACY_KEY',
    invoiceKeyV2: 'SYNTHETIC_INVOICE_KEY_V2',
    sourceLineNo: 1,
    lineIdentityV2: 'synthetic-line-id-1',
    legacyHashIndex: 'synthetic-line-hash-1',
    transactionIdentity: 'synthetic-line-id-1',
    direction: 'NHAP',
    itemCode: 'ITEM-1',
    itemName: 'Synthetic item',
    quantity: 1,
    unitPrice: 100,
    ...overrides
  };
}

function fakeLock(calls = []) {
  return {
    tryLock(ms) {
      calls.push(['tryLock', ms]);
      return true;
    },
    releaseLock() {
      calls.push(['releaseLock']);
    }
  };
}

function makeLeaseStore(options = {}) {
  const state = { active: Boolean(options.active), createdCount: 0 };
  return {
    state,
    async acquireLease(request) {
      if (state.active && state.jobId !== request.jobId) {
        const error = new Error('lease conflict');
        error.code = 'ALREADY_EXISTS';
        throw error;
      }
      if (state.active && state.jobId === request.jobId) return { idempotent: true };
      state.active = true;
      state.jobId = request.jobId;
      state.createdCount += 1;
      return { idempotent: false };
    }
  };
}

function makeHarness(options = {}) {
  const transport = options.transport || createFakeFirestoreTransport();
  const clock = { now: () => '2026-07-26T00:00:00.000Z' };
  const store = gas.call('createDurableInvoiceJobStore', transport, { clock });
  const leaseStore = options.leaseStore || makeLeaseStore();
  const drive = gas.call('createFakeSgdsDriveAdapter_', {
    folders: [
      { exists: true, folderKey: 'NHAP/2026/XML', folderReference: 'folder-xml' },
      { exists: true, folderKey: 'NHAP/2026/PDF', folderReference: 'folder-pdf' }
    ],
    files: options.driveFiles || []
  });
  const sheets = gas.call('createFakeSgdsSheetsLedgerAdapter_', {
    ledgerRows: options.ledgerRows || []
  });
  const lockCalls = [];
  const logger = { lines: [], log(value) { this.lines.push(String(value)); } };
  const runner = gas.call('createD6jCOneRecordProductionMutationRunner_', {
    readProperties: () => options.props || baseProps(),
    createLock: () => options.lock || fakeLock(lockCalls),
    runPreflight: () => options.preflight || passPreflight(),
    readPilotArtifacts: () => options.artifacts || artifacts(),
    buildLedgerRows: () => options.ledgerRowsForPlan || [ledgerRow()],
    createJobStore: () => store,
    createLeaseStore: () => leaseStore,
    createDriveAdapters: () => options.drive || drive,
    createSheetsAdapters: () => options.sheets || sheets,
    clock,
    logger
  });
  return { runner, store, transport, leaseStore, drive, sheets, lockCalls, logger };
}

test('metadata and D6J-C entrypoint contract are canonical', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(gas.exports.D6J_C_MUTATION_ENTRYPOINT_, 'runD6jCOneRecordProductionMutation');
  assert.equal(gas.exports.D6J_C_MUTATION_SCHEMA_VERSION_, 'D6J_C_CONTROLLED_ONE_RECORD_PRODUCTION_MUTATION_CHANNEL_V1');
  assert.equal(gas.exports.D6J_C_MUTATION_APPROVAL_, 'OWNER_APPROVED_D6J_C_ONE_RECORD_PRODUCTION_MUTATION');
  assert.equal(gas.exports.D6J_C_MUTATION_APPROVAL_PROPERTY_, 'D6J_C_MUTATION_APPROVAL_MARKER');
});

test('missing owner marker blocks before mutation', async () => {
  const h = makeHarness({ props: baseProps({ D6J_C_MUTATION_APPROVAL_MARKER: '' }) });
  const result = fromVm(await h.runner.run());
  assert.equal(result.MUTATION_STATUS, 'BLOCKED_INVALID_D6J_C_MUTATION_APPROVAL_MARKER');
  assert.equal(result.OWNER_APPROVAL_MARKER_VALID, 'NO');
  assert.equal(result.PRODUCTION_MUTATION_COUNT, 0);
  assert.equal(h.drive.state.mutationLog.length, 0);
  assert.equal(h.sheets.state.mutationLog.length, 0);
});

test('invalid marker blocks', async () => {
  const h = makeHarness({ props: baseProps({ D6J_C_MUTATION_APPROVAL_MARKER: 'OWNER_APPROVED_D6J_ONE_RECORD_PRODUCTION_MUTATION' }) });
  const result = fromVm(await h.runner.run());
  assert.equal(result.MUTATION_STATUS, 'BLOCKED_INVALID_D6J_C_MUTATION_APPROVAL_MARKER');
  assert.equal(result.PRODUCTION_MUTATION_COUNT, 0);
});

test('failed D6J-B preflight blocks before production mutation', async () => {
  const h = makeHarness({ preflight: passPreflight({ DRY_RUN_STATUS: 'BLOCKED_GMAIL_QUERY_ZERO_MATCH', GMAIL_QUERY_MATCH_COUNT: 0 }) });
  const result = fromVm(await h.runner.run());
  assert.equal(result.MUTATION_STATUS, 'BLOCKED_D6J_B_PREFLIGHT_STATUS');
  assert.equal(result.PREFLIGHT_STATUS, 'NOT_RUN');
  assert.equal(result.PRODUCTION_MUTATION_COUNT, 0);
});

test('existing active lease blocks before Drive and Sheets mutation', async () => {
  const h = makeHarness({ leaseStore: makeLeaseStore({ active: true }) });
  const result = fromVm(await h.runner.run());
  assert.equal(result.MUTATION_STATUS, 'BLOCKED_ACTIVE_LEASE');
  assert.equal(result.LEASE_STATUS, 'ACTIVE_LEASE_FOUND');
  assert.equal(result.DRIVE_MUTATION_COUNT, 0);
  assert.equal(result.SHEETS_MUTATION_COUNT, 0);
});

test('first successful run creates exactly two Drive files, appends one Sheet row, and completes Firestore job', async () => {
  const h = makeHarness();
  const result = fromVm(await h.runner.run());
  assert.equal(result.MUTATION_STATUS, 'PASS_ONE_RECORD_PRODUCTION_MUTATION_CHANNEL_READY');
  assert.equal(result.PREFLIGHT_STATUS, 'PASS_EXACT_PRODUCTION_DRY_RUN_READ_ONLY');
  assert.equal(result.OWNER_APPROVAL_MARKER_VALID, 'YES');
  assert.equal(result.LEASE_STATUS, 'ACQUIRED');
  assert.equal(result.COMMIT_PLAN_STATUS, 'PLAN_SAVED');
  assert.equal(result.DRIVE_FILES_CREATED, 2);
  assert.equal(result.SHEETS_ROWS_APPENDED, 1);
  assert.equal(result.FIRESTORE_JOB_STATUS, 'COMPLETED');
  assert.equal(result.RECONCILIATION_STATUS, 'CONSISTENT');
  assert.equal(h.drive.state.files.length, 2);
  assert.equal(h.sheets.state.ledgerRows.length, 1);
  assert.equal(h.lockCalls.map(call => call[0]).join(','), 'tryLock,releaseLock');
});

test('second identical run creates zero Drive files and zero Sheet rows with idempotent completed no-op', async () => {
  const h = makeHarness();
  const first = fromVm(await h.runner.run());
  const secondRunner = gas.call('createD6jCOneRecordProductionMutationRunner_', {
    readProperties: () => baseProps(),
    createLock: () => fakeLock([]),
    runPreflight: () => passPreflight({ FIRESTORE_ACTIVE_LEASE_STATUS: 'EXISTING_RECORDS_FOUND' }),
    readPilotArtifacts: () => artifacts(),
    buildLedgerRows: () => [ledgerRow()],
    createJobStore: () => h.store,
    createLeaseStore: () => h.leaseStore,
    createDriveAdapters: () => h.drive,
    createSheetsAdapters: () => h.sheets,
    clock: { now: () => '2026-07-26T00:00:00.000Z' },
    logger: { log() {} }
  });
  const second = fromVm(await secondRunner.run());
  assert.equal(first.FIRESTORE_JOB_STATUS, 'COMPLETED');
  assert.equal(second.MUTATION_STATUS, 'PASS_IDEMPOTENT_COMPLETED_NOOP');
  assert.equal(second.DRIVE_FILES_CREATED, 0);
  assert.equal(second.SHEETS_ROWS_APPENDED, 0);
  assert.equal(second.IDEMPOTENT_RERUN_STATUS, 'IDEMPOTENT_COMPLETE_NOOP');
  assert.equal(h.drive.state.files.length, 2);
  assert.equal(h.sheets.state.ledgerRows.length, 1);
});

test('existing Drive hash conflict blocks and marks no Drive creation', async () => {
  const targetIdentity = gas.call('buildSgdsDriveArtifactIdentity_', {
    invoiceKeyV2: 'SYNTHETIC_INVOICE_KEY_V2',
    messageId: 'msg-synthetic-001',
    attachmentId: 'XML_' + gas.call('hashPrefixD6jC_', 'msg-synthetic-001|xmlhash', 16),
    contentHash: 'xmlhash',
    artifactType: 'XML'
  });
  const h = makeHarness({
    driveFiles: [{
      exists: true,
      logicalFileIdentity: targetIdentity,
      fileReference: 'conflict-file',
      folderReference: 'folder-xml',
      fileName: 'synthetic-invoice.xml',
      artifactType: 'XML',
      mimeType: 'application/xml',
      contentHash: 'conflicting-hash',
      byteSize: 999
    }]
  });
  const result = fromVm(await h.runner.run());
  assert.equal(result.MUTATION_STATUS, 'BLOCKED_D6J_C_DRIVE_XML_HASH_MISMATCH');
  assert.equal(result.SHEETS_ROWS_APPENDED, 0);
});

test('existing Sheet identity conflict blocks', async () => {
  const h = makeHarness({
    ledgerRows: [ledgerRow({ invoiceKeyV2: 'OTHER', legacyInvoiceKey: 'OTHER', transactionIdentity: 'synthetic-line-id-1', lineIdentityV2: 'synthetic-line-id-1' })]
  });
  const result = fromVm(await h.runner.run());
  assert.equal(result.MUTATION_STATUS, 'BLOCKED_D6J_C_SHEET_TRANSACTION_CONFLICT');
});

test('failure after first Drive file creates reconciliation-required state', async () => {
  const h = makeHarness();
  let callCount = 0;
  const drive = {
    ...h.drive,
    mutate: {
      ...h.drive.mutate,
      async createFileIfAbsent(request) {
        callCount += 1;
        if (callCount === 2) {
          const error = new Error('synthetic pdf failure');
          error.code = 'D6J_C_SYNTHETIC_PDF_FAILURE';
          throw error;
        }
        return h.drive.mutate.createFileIfAbsent(request);
      }
    }
  };
  const h2 = makeHarness({ drive });
  const result = fromVm(await h2.runner.run());
  assert.equal(result.MUTATION_STATUS, 'D6J_C_SYNTHETIC_PDF_FAILURE');
  assert.equal(result.DRIVE_FILES_CREATED, 1);
  assert.equal(result.RECONCILIATION_STATUS, 'RECONCILIATION_REQUIRED');
  const job = fromVm(await h2.store.getJob(result.JOB_ID));
  assert.equal(job.reconciliationStatus, 'RECONCILIATION_REQUIRED');
});

test('failure after both Drive files but before Sheet append resumes safely without duplicate Drive files', async () => {
  const h = makeHarness();
  const failingSheets = {
    ...h.sheets,
    mutate: {
      ...h.sheets.mutate,
      async appendImmutableTransactionsIfAbsent() {
        const error = new Error('synthetic sheet unavailable');
        error.code = 'D6J_C_SYNTHETIC_SHEET_UNAVAILABLE';
        throw error;
      }
    }
  };
  const firstRunner = gas.call('createD6jCOneRecordProductionMutationRunner_', {
    readProperties: () => baseProps(),
    createLock: () => fakeLock([]),
    runPreflight: () => passPreflight(),
    readPilotArtifacts: () => artifacts(),
    buildLedgerRows: () => [ledgerRow()],
    createJobStore: () => h.store,
    createLeaseStore: () => h.leaseStore,
    createDriveAdapters: () => h.drive,
    createSheetsAdapters: () => failingSheets,
    clock: { now: () => '2026-07-26T00:00:00.000Z' },
    logger: { log() {} }
  });
  const first = fromVm(await firstRunner.run());
  assert.equal(first.DRIVE_FILES_CREATED, 2);
  const retryRunner = gas.call('createD6jCOneRecordProductionMutationRunner_', {
    readProperties: () => baseProps(),
    createLock: () => fakeLock([]),
    runPreflight: () => passPreflight({ FIRESTORE_ACTIVE_LEASE_STATUS: 'EXISTING_RECORDS_FOUND' }),
    readPilotArtifacts: () => artifacts(),
    buildLedgerRows: () => [ledgerRow()],
    createJobStore: () => h.store,
    createLeaseStore: () => h.leaseStore,
    createDriveAdapters: () => h.drive,
    createSheetsAdapters: () => h.sheets,
    clock: { now: () => '2026-07-26T00:00:00.000Z' },
    logger: { log() {} }
  });
  const retry = fromVm(await retryRunner.run());
  assert.equal(retry.DRIVE_FILES_CREATED, 0);
  assert.equal(retry.DRIVE_FILES_ALREADY_PRESENT, 2);
  assert.equal(retry.SHEETS_ROWS_APPENDED, 1);
});

test('failure after Sheet append but before completion resumes without duplicate row', async () => {
  const h = makeHarness();
  const failingStore = {
    ...h.store,
    async saveReconciliationReport(request) {
      const error = new Error('synthetic report unavailable');
      error.code = 'D6J_C_SYNTHETIC_REPORT_FAILURE';
      throw error;
    }
  };
  const firstRunner = gas.call('createD6jCOneRecordProductionMutationRunner_', {
    readProperties: () => baseProps(),
    createLock: () => fakeLock([]),
    runPreflight: () => passPreflight(),
    readPilotArtifacts: () => artifacts(),
    buildLedgerRows: () => [ledgerRow()],
    createJobStore: () => failingStore,
    createLeaseStore: () => h.leaseStore,
    createDriveAdapters: () => h.drive,
    createSheetsAdapters: () => h.sheets,
    clock: { now: () => '2026-07-26T00:00:00.000Z' },
    logger: { log() {} }
  });
  const first = fromVm(await firstRunner.run());
  assert.equal(first.SHEETS_ROWS_APPENDED, 1);
  const retryRunner = gas.call('createD6jCOneRecordProductionMutationRunner_', {
    readProperties: () => baseProps(),
    createLock: () => fakeLock([]),
    runPreflight: () => passPreflight({ FIRESTORE_ACTIVE_LEASE_STATUS: 'EXISTING_RECORDS_FOUND' }),
    readPilotArtifacts: () => artifacts(),
    buildLedgerRows: () => [ledgerRow()],
    createJobStore: () => h.store,
    createLeaseStore: () => h.leaseStore,
    createDriveAdapters: () => h.drive,
    createSheetsAdapters: () => h.sheets,
    clock: { now: () => '2026-07-26T00:00:00.000Z' },
    logger: { log() {} }
  });
  const retry = fromVm(await retryRunner.run());
  assert.equal(retry.SHEETS_ROWS_APPENDED, 0);
  assert.equal(h.sheets.state.ledgerRows.length, 1);
});

test('no Gmail mutation, no trigger mutation, and no destructive operation are reported', async () => {
  const h = makeHarness();
  const result = fromVm(await h.runner.run());
  assert.equal(result.GMAIL_MUTATION_COUNT, 0);
  assert.equal(result.TRIGGER_MUTATION_COUNT, 0);
  assert.equal(result.DESTRUCTIVE_OPERATION_COUNT, 0);
});

test('logs contain no secrets or attachment data', async () => {
  const logger = { lines: [], log(value) { this.lines.push(String(value)); } };
  const h = makeHarness();
  const runner = gas.call('createD6jCOneRecordProductionMutationRunner_', {
    readProperties: () => baseProps(),
    createLock: () => fakeLock([]),
    runPreflight: () => passPreflight(),
    readPilotArtifacts: () => artifacts(),
    buildLedgerRows: () => [ledgerRow()],
    createJobStore: () => h.store,
    createLeaseStore: () => h.leaseStore,
    createDriveAdapters: () => h.drive,
    createSheetsAdapters: () => h.sheets,
    clock: { now: () => '2026-07-26T00:00:00.000Z' },
    logger
  });
  await runner.run();
  const text = logger.lines.join('\n');
  for (const forbidden of ['Bearer', 'Authorization', 'refresh_token', 'private_key', 'client_secret', '<xml', 'JVBERi0', '1,2,3', '4,5,6,7']) {
    assert.equal(text.includes(forbidden), false, `log leaked ${forbidden}`);
  }
  assert.throws(() => gas.call('logD6jCSanitizedResult_', logger, { unsafe: 'Bearer token-value' }), /BLOCKED_UNSAFE_D6J_C_LOG_PAYLOAD/);
});

test('source contains no private pilot values and does not call forbidden production entrypoints', () => {
  const source = fs.readFileSync('d6jCOneRecordProductionMutation.js', 'utf8');
  for (const forbidden of [
    ['no-reply', '@', 'meinvoice.vn'].join(''),
    ['0000', '0248'].join(''),
    ['1C26THD_', '0000', '0248'].join(''),
    ['1cNCIC_', 'Tv5Y3td80xMCTCl4vCWAoyFzxW'].join(''),
    ['1yBbalX91VZkGIBaUJZQRt5eVllVlo', '53696M5hMLNAoc'].join(''),
    'ScriptApp.newTrigger',
    'ScriptApp.deleteTrigger',
    'mainRun(',
    'scanInvoiceOutEmails_(',
    'scanInvoiceInEmails_(',
    'triggerScanInvoiceDriveFolder(',
    '.setTrashed(',
    '.deleteRow(',
    '.clear('
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden source token present: ${forbidden}`);
  }
});
