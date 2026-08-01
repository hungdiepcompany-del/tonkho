import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createFakeFirestoreTransport } from '../../fixtures/sgds-crit-003-d2/firestore-adapter-fixtures.mjs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'D7_E_OwnerApprovedOneCandidateProductionPilot.js',
    'Operator_Entrypoints.js',
    'D7_B_BoundedReadOnlyCandidateDiscovery.js',
    'd6jCOneRecordProductionMutation.js',
    'firestoreDurableJobStore.js',
    'sgdsGmailAdapter.js',
    'sgdsDriveAdapter.js',
    'sgdsSheetsLedgerAdapter.js',
    'scripts/checkers/check-d7-e-owner-approved-one-candidate-production-pilot.mjs',
  ],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE',
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
    'd6jCOneRecordProductionMutation.js',
    'D7_E_OwnerApprovedOneCandidateProductionPilot.js',
    'Operator_Entrypoints.js',
  ],
  exportNames: [
    'D7_E_SCHEMA_VERSION_',
    'D7_E_ENTRYPOINT_',
    'D7_E_APPROVAL_PROPERTY_',
    'D7_E_APPROVAL_MARKER_',
    'D7_E_EXPECTED_CANDIDATE_FINGERPRINT_PROPERTY_',
    'D7_E_EXPECTED_INVOICE_KEY_HASH_PROPERTY_',
    'D7_E_EXPECTED_ATTACHMENT_SET_SHA256_PROPERTY_',
    'createD7EOwnerApprovedOneCandidateProductionPilotRunner_',
    'runD7EOwnerApprovedOneCandidateProductionPilot',
    'getD7EMutationBudgets_',
    'assertD7EObservedMutationBudget_',
    'createD7EAttachmentRecordStore_',
    'createDurableInvoiceJobStore',
    'createD6jCFirestoreLeaseStore_',
    'createFakeSgdsDriveAdapter_',
    'createFakeSgdsSheetsLedgerAdapter_',
    'hashPrefixD7E_',
    'deriveD7EProductionMutation_',
  ],
});

const fromVm = value => JSON.parse(JSON.stringify(value));
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);
const HASH_E = 'e'.repeat(64);
const MESSAGE_HASH = '1'.repeat(16);
const THREAD_HASH = '2'.repeat(16);
const JOB_ID = 'd7e_job_' + HASH_A.slice(0, 24);
const OLD_D6J_MARKER = ['OWNER', 'APPROVED', 'D6J', 'C', 'ONE', 'RECORD', 'PRODUCTION', 'MUTATION'].join('_');

test('metadata and public entrypoint contract are canonical', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(gas.exports.D7_E_ENTRYPOINT_, 'runD7EOwnerApprovedOneCandidateProductionPilot');
  assert.equal(gas.exports.D7_E_SCHEMA_VERSION_, 'D7_E_OWNER_APPROVED_ONE_CANDIDATE_PRODUCTION_PILOT_V1');
  assert.equal(gas.exports.D7_E_APPROVAL_PROPERTY_, 'D7_E_OWNER_APPROVAL_MARKER');
  assert.equal(gas.exports.D7_E_APPROVAL_MARKER_, 'OWNER_APPROVE_D7E_ONE_CANDIDATE_PRODUCTION_PILOT');
  assert.equal(typeof gas.exports.runD7EOwnerApprovedOneCandidateProductionPilot, 'function');

  const entrypoints = fs.readFileSync('Operator_Entrypoints.js', 'utf8');
  const match = entrypoints.match(/function runD7EOwnerApprovedOneCandidateProductionPilot\(\) \{([\s\S]*?)\n\}/);
  assert.ok(match, 'D7_E_ENTRYPOINT_MISSING');
  assert.match(match[1], /const runner = createD7EOwnerApprovedOneCandidateProductionPilotRunner_\(\);/);
  assert.match(match[1], /return runner\.run\(\);/);
  assert.doesNotMatch(match[1], /runD6jCOneRecordProductionMutation/);
});

test('deriveD7EProductionMutation_ classifies confirmed and unknown outcomes', () => {
  const cases = [
    ['zero confirmed, zero unknown', {}, 'NONE'],
    ['external plus Firestore confirmed', { DRIVE_MUTATION_COUNT: 1, FIRESTORE_TOTAL_WRITE_OPERATIONS: 1 }, 'PARTIAL'],
    ['external confirmed only', { SHEETS_MUTATION_COUNT: 1 }, 'EXTERNAL_ONLY'],
    ['Firestore confirmed only', { FIRESTORE_TOTAL_WRITE_OPERATIONS: 1 }, 'FIRESTORE_ONLY'],
    ['positive unmatched confirmed total', { PRODUCTION_MUTATION_COUNT: 1 }, 'PARTIAL'],
    ['Drive unknown', { DRIVE_WRITE_OUTCOME_UNKNOWN_COUNT: 1 }, 'OUTCOME_UNKNOWN'],
    ['Sheets unknown', { SHEETS_WRITE_OUTCOME_UNKNOWN_COUNT: 1 }, 'OUTCOME_UNKNOWN'],
    ['Firestore unknown', { FIRESTORE_WRITE_OUTCOME_UNKNOWN_COUNT: 1 }, 'OUTCOME_UNKNOWN'],
    ['confirmed plus unknown', { DRIVE_MUTATION_COUNT: 1, FIRESTORE_WRITE_OUTCOME_UNKNOWN_COUNT: 1 }, 'OUTCOME_UNKNOWN'],
    [
      'successful bounded production pilot stays bounded',
      { D7_E_STATUS: 'PASS_ONE_CANDIDATE_PRODUCTION_PILOT_COMPLETED', DRIVE_MUTATION_COUNT: 1 },
      'BOUNDED_ONE_CANDIDATE_PILOT',
    ],
  ];
  for (const [name, input, expected] of cases) {
    assert.equal(gas.call('deriveD7EProductionMutation_', input), expected, name);
  }
});

function props(overrides = {}) {
  return {
    D7_E_OWNER_APPROVAL_MARKER: 'OWNER_APPROVE_D7E_ONE_CANDIDATE_PRODUCTION_PILOT',
    D7_E_EXPECTED_CANDIDATE_FINGERPRINT: HASH_A,
    D7_E_EXPECTED_INVOICE_KEY_HASH: HASH_B,
    D7_E_EXPECTED_ATTACHMENT_SET_SHA256: HASH_C,
    D7_B_DRIVE_ROOT_FOLDER_ID: 'folder-root',
    D7_B_SPREADSHEET_ID: 'sheet-ledger',
    D7_B_TARGET_SHEET_NAME: 'Nhap-Xuat',
    ...overrides,
  };
}

function candidate(overrides = {}) {
  return {
    message: {
      messageIdHash: MESSAGE_HASH,
      threadIdHash: THREAD_HASH,
    },
    xml: {
      sha256: HASH_D,
      fileName: 'synthetic.xml',
      mimeType: 'application/xml',
      byteSize: 4,
      bytes: [60, 120, 47, 62],
    },
    pdf: {
      sha256: HASH_E,
      fileName: 'synthetic.pdf',
      mimeType: 'application/pdf',
      byteSize: 3,
      bytes: [80, 68, 70],
    },
    ...overrides,
  };
}

function precheck(overrides = {}) {
  const c = overrides.candidate === null ? null : candidate(overrides.candidate || {});
  const summary = {
    D7_B_STATUS: 'PASS_EXACTLY_ONE_ELIGIBLE_CANDIDATE_READY_FOR_OWNER_REVIEW',
    CANDIDATE_DISCOVERY_STATUS: 'PASS_EXACTLY_ONE_ELIGIBLE_CANDIDATE_READY_FOR_OWNER_REVIEW',
    RUNTIME_SAFETY_RECHECK: 'PASS',
    EFFECTIVE_CONFIG_STATUS: 'PASS',
    CANDIDATE_DISCOVERY_EXECUTED: 'YES_READ_ONLY',
    ELIGIBLE_CANDIDATE_COUNT: 1,
    APPROVED_CANDIDATE_COUNT: 1,
    INSPECTED_ATTACHMENT_COUNT: 2,
    ATTACHMENT_VALIDATION_STATUS: 'PASS',
    CARDINALITY_STATUS: 'EXACTLY_ONE_ELIGIBLE_CANDIDATE',
    FINGERPRINT_STATUS: 'PASS',
    GMAIL_DUPLICATE_STATUS: 'NOT_FOUND',
    DRIVE_DUPLICATE_STATUS: 'NOT_FOUND',
    SHEET_DUPLICATE_STATUS: 'NOT_FOUND',
    FIRESTORE_DUPLICATE_STATUS: 'NOT_FOUND',
    CANDIDATE_FINGERPRINT: HASH_A,
    INVOICE_KEY_HASH: HASH_B,
    ATTACHMENT_SET_SHA256: HASH_C,
    MESSAGE_ID_HASH: MESSAGE_HASH,
    THREAD_ID_HASH: THREAD_HASH,
    ...(overrides.summary || {}),
  };
  return {
    config: {
      folderId: 'folder-root',
      spreadsheetId: 'sheet-ledger',
      sheetName: 'Nhap-Xuat',
      ...(overrides.config || {}),
    },
    candidate: c,
    fingerprint: { summary },
    summary,
  };
}

function ledgerRow(overrides = {}) {
  return {
    issueDate: '2026-03-09',
    invoiceNo: '00000248',
    customerName: 'Synthetic customer',
    sellerTaxCode: '0000000000',
    legacyInvoiceKey: '20260309_0000000000_00000248',
    invoiceKeyV2: '20260309_0000000000_00000248',
    sourceLineNo: 1,
    lineIdentityV2: 'line_identity_d7e_001',
    legacyHashIndex: 'hash_index_d7e_001',
    transactionIdentity: 'line_identity_d7e_001',
    direction: 'NHAP',
    itemCode: 'ITEM-1',
    itemName: 'Synthetic item',
    quantity: 1,
    unitPrice: 100,
    amount: 100,
    ...overrides,
  };
}

function fakeLock(calls = [], acquired = true, releaseThrows = false) {
  return {
    tryLock(ms) {
      calls.push(['tryLock', ms]);
      return acquired;
    },
    releaseLock() {
      calls.push(['releaseLock']);
      if (releaseThrows) {
        const error = new Error('D7_E_SYNTHETIC_LOCK_RELEASE_LOSS');
        error.code = 'D7_E_SYNTHETIC_LOCK_RELEASE_LOSS';
        throw error;
      }
    },
  };
}

function makeDrive(options = {}) {
  return gas.call('createFakeSgdsDriveAdapter_', {
    folders: [
      { exists: true, folderKey: 'NHAP/2026/XML', folderReference: 'folder-xml' },
      { exists: true, folderKey: 'NHAP/2026/PDF', folderReference: 'folder-pdf' },
    ],
    files: options.files || [],
  });
}

function makeSheets(options = {}) {
  return gas.call('createFakeSgdsSheetsLedgerAdapter_', {
    ledgerRows: options.ledgerRows || [],
  });
}

function makeHarness(options = {}) {
  const transport = options.transport || createFakeFirestoreTransport(options.transportOptions || {});
  const clock = options.clock || { now: () => '2026-07-29T00:00:00.000Z' };
  const jobStore = options.jobStore || gas.call('createDurableInvoiceJobStore', transport, { clock });
  const leaseStore = options.leaseStore || gas.call('createD6jCFirestoreLeaseStore_', transport, { clock, leaseDurationMs: 600000 });
  const attachmentStore = options.attachmentStore || gas.call('createD7EAttachmentRecordStore_', transport);
  const drive = options.drive || makeDrive();
  const sheets = options.sheets || makeSheets();
  const lockCalls = [];
  const logger = { lines: [], log(value) { this.lines.push(String(value)); } };
  const prechecks = options.prechecks || [options.precheck || precheck()];
  let precheckIndex = 0;
  const runner = gas.call('createD7EOwnerApprovedOneCandidateProductionPilotRunner_', {
    readProperties: () => options.props || props(),
    rediscoverCandidate: () => fromVm(prechecks[Math.min(precheckIndex++, prechecks.length - 1)]),
    buildLedgerRows: () => options.ledgerRowsForPlan || [ledgerRow()],
    validateSheetSchema: () => options.sheetSchema || { status: 'PASS' },
    createLock: () => options.lock || fakeLock(lockCalls, options.lockAcquired !== false, options.releaseLockThrows === true),
    createJobStore: () => jobStore,
    createLeaseStore: () => leaseStore,
    createAttachmentRecordStore: () => attachmentStore,
    createDriveAdapters: () => drive,
    createSheetsAdapters: () => sheets,
    clock,
    logger,
  });
  return { runner, transport, jobStore, leaseStore, attachmentStore, drive, sheets, lockCalls, logger };
}

function assertNoExternalMutation(h) {
  assert.equal(h.drive.state.mutationLog.length, 0);
  assert.equal(h.sheets.state.mutationLog.length, 0);
}

function assertSafeLogLines(lines) {
  const text = lines.join('\n');
  assert.doesNotMatch(text, /@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  assert.doesNotMatch(text, /raw-message-id|raw-thread-id|synthetic subject text/i);
  assert.doesNotMatch(text, /<\?xml|<Invoice|JVBERi0|Bearer|Authorization|ya29\.|client_secret|private_key/i);
}

test('approved D7-E run completes one bounded candidate with deterministic lifecycle counts', async () => {
  const h = makeHarness();
  const result = fromVm(await h.runner.run());
  assert.equal(result.D7_E_STATUS, 'PASS_ONE_CANDIDATE_PRODUCTION_PILOT_COMPLETED');
  assert.equal(result.APPROVAL_STATUS, 'PASS');
  assert.equal(result.OWNER_APPROVAL_MARKER_VALID, 'YES');
  assert.equal(result.CANDIDATE_REDISCOVERY_STATUS, 'PASS_EXACTLY_ONE_ELIGIBLE_CANDIDATE_READY_FOR_OWNER_REVIEW');
  assert.equal(result.CANDIDATE_FINGERPRINT_MATCH, 'YES');
  assert.equal(result.INVOICE_KEY_HASH_MATCH, 'YES');
  assert.equal(result.ATTACHMENT_SET_SHA256_MATCH, 'YES');
  assert.equal(result.SHEET_SCHEMA_STATUS, 'PASS');
  assert.equal(result.LOCK_STATUS, 'ACQUIRED');
  assert.equal(result.LOCK_RECHECK_STATUS, 'PASS');
  assert.equal(result.LEASE_STATUS, 'ACQUIRED');
  assert.equal(result.LEASE_FINAL_STATUS, 'RELEASED');
  assert.equal(result.DRIVE_FILES_CREATED, 2);
  assert.equal(result.SHEETS_ROWS_APPENDED, 1);
  assert.equal(result.FIRESTORE_JOBS_CREATED, 1);
  assert.equal(result.FIRESTORE_ATTACHMENT_RECORDS_CREATED, 2);
  assert.equal(result.FIRESTORE_JOB_TRANSITION_COUNT, 5);
  assert.equal(result.FIRESTORE_AUDIT_EVENT_COUNT, 3);
  assert.equal(result.FIRESTORE_RECONCILIATION_REPORT_COUNT, 1);
  assert.equal(result.FIRESTORE_TOTAL_WRITE_OPERATIONS, 16);
  assert.equal(result.FIRESTORE_MUTATION_COUNT, 16);
  assert.equal(result.GMAIL_LABEL_MUTATION_COUNT, 0);
  assert.equal(result.SCRIPT_PROPERTY_MUTATION_COUNT, 0);
  assert.equal(result.TRIGGER_MUTATION_COUNT, 0);
  assert.equal(result.DESTRUCTIVE_OPERATION_COUNT, 0);
  assert.equal(result.RECONCILIATION_STATUS, 'CONSISTENT');
  assert.equal(result.IDEMPOTENT_RERUN_STATUS, 'READY_FOR_IDEMPOTENT_RERUN');
  assert.equal(result.PRODUCTION_MUTATION, 'BOUNDED_ONE_CANDIDATE_PILOT');
  assert.equal(result.DRIVE_WRITE_OUTCOME_UNKNOWN_COUNT, 0);
  assert.equal(result.SHEETS_WRITE_OUTCOME_UNKNOWN_COUNT, 0);
  assert.equal(result.FIRESTORE_WRITE_OUTCOME_UNKNOWN_COUNT, 0);
  assert.equal(result.PRODUCTION_MUTATION_OUTCOME_UNKNOWN, 'NO');
  assert.equal(h.drive.state.mutationLog.length, 2);
  assert.equal(h.sheets.state.mutationLog.length, 1);
  assert.deepEqual(h.lockCalls.map(call => call[0]), ['tryLock', 'releaseLock']);
  const job = fromVm(await h.jobStore.getJob(JOB_ID));
  assert.equal(job.status, 'COMPLETED');
  assertSafeLogLines(h.logger.lines);
});

test('approval, candidate cardinality, identity, attachment, and precheck failures stop before mutation', async () => {
  const cases = [
    ['missing approval marker', { props: props({ D7_E_OWNER_APPROVAL_MARKER: '' }) }, 'BLOCKED_INVALID_D7_E_APPROVAL_MARKER'],
    ['wrong marker', { props: props({ D7_E_OWNER_APPROVAL_MARKER: 'WRONG_MARKER' }) }, 'BLOCKED_INVALID_D7_E_APPROVAL_MARKER'],
    ['old D6J marker cannot substitute', { props: { D6J_C_MUTATION_APPROVAL_MARKER: OLD_D6J_MARKER } }, 'BLOCKED_OLD_D6J_MARKER_CANNOT_AUTHORIZE_D7_E'],
    ['missing expected fingerprint', { props: props({ D7_E_EXPECTED_CANDIDATE_FINGERPRINT: '' }) }, 'BLOCKED_MALFORMED_D7_E_EXPECTED_HASH_D7_E_EXPECTED_CANDIDATE_FINGERPRINT'],
    ['malformed expected hash', { props: props({ D7_E_EXPECTED_INVOICE_KEY_HASH: 'not-a-hex-hash' }) }, 'BLOCKED_MALFORMED_D7_E_EXPECTED_HASH_D7_E_EXPECTED_INVOICE_KEY_HASH'],
    ['candidate count zero', { precheck: precheck({ candidate: null, summary: { ELIGIBLE_CANDIDATE_COUNT: 0, APPROVED_CANDIDATE_COUNT: 0, CARDINALITY_STATUS: 'NO_ELIGIBLE_CANDIDATE' } }) }, 'BLOCKED_D7_E_CANDIDATE_COUNT_NOT_ONE'],
    ['multiple candidates', { precheck: precheck({ summary: { ELIGIBLE_CANDIDATE_COUNT: 2, APPROVED_CANDIDATE_COUNT: 2, CARDINALITY_STATUS: 'MULTIPLE_ELIGIBLE_CANDIDATES' } }) }, 'BLOCKED_D7_E_CANDIDATE_COUNT_NOT_ONE'],
    ['fingerprint mismatch', { precheck: precheck({ summary: { CANDIDATE_FINGERPRINT: 'f'.repeat(64) } }) }, 'BLOCKED_D7_E_CANDIDATE_FINGERPRINT_MISMATCH'],
    ['invoice-key mismatch', { precheck: precheck({ summary: { INVOICE_KEY_HASH: 'f'.repeat(64) } }) }, 'BLOCKED_D7_E_INVOICE_KEY_HASH_MISMATCH'],
    ['attachment-set mismatch', { precheck: precheck({ summary: { ATTACHMENT_SET_SHA256: 'f'.repeat(64) } }) }, 'BLOCKED_D7_E_ATTACHMENT_SET_HASH_MISMATCH'],
    ['PDF/XML mismatch', { precheck: precheck({ summary: { ATTACHMENT_VALIDATION_STATUS: 'BLOCKED_ATTACHMENT_VALIDATION_FAILURE' } }) }, 'BLOCKED_D7_E_ATTACHMENT_VALIDATION'],
    ['unknown precheck state', { precheck: precheck({ summary: { RUNTIME_SAFETY_RECHECK: 'UNKNOWN' } }) }, 'BLOCKED_D7_E_RUNTIME_SAFETY_RECHECK'],
  ];

  for (const [name, options, expected] of cases) {
    const h = makeHarness(options);
    const result = fromVm(await h.runner.run());
    assert.equal(result.D7_E_STATUS, expected, name);
    assert.equal(result.PRODUCTION_MUTATION_COUNT, 0, name);
    assert.equal(result.PRODUCTION_MUTATION, 'NONE', name);
    assertNoExternalMutation(h);
  }
});

test('duplicate, schema, lock, lease, kill-switch, and mutation budget exceeded gates fail closed', async () => {
  const cases = [
    ['Drive conflict', { precheck: precheck({ summary: { DRIVE_DUPLICATE_STATUS: 'CONFLICTING_DUPLICATE' } }) }, 'BLOCKED_D7_E_DRIVE_DUPLICATE'],
    ['Sheet conflict', { precheck: precheck({ summary: { SHEET_DUPLICATE_STATUS: 'CONFLICTING_DUPLICATE' } }) }, 'BLOCKED_D7_E_SHEET_DUPLICATE'],
    ['Firestore conflict', { precheck: precheck({ summary: { FIRESTORE_DUPLICATE_STATUS: 'CONFLICTING_DUPLICATE' } }) }, 'BLOCKED_D7_E_FIRESTORE_DUPLICATE'],
    ['exact duplicate without completed job', { precheck: precheck({ summary: { D7_B_STATUS: 'BLOCKED_EXACT_DUPLICATE', DRIVE_DUPLICATE_STATUS: 'EXACT_DUPLICATE' } }) }, 'BLOCKED_D7_E_DRIVE_DUPLICATE'],
    ['schema mismatch', { sheetSchema: { status: 'BLOCKED_D7_E_SHEET_SCHEMA_MISMATCH' } }, 'BLOCKED_D7_E_SHEET_SCHEMA_MISMATCH'],
    ['lock unavailable', { lockAcquired: false }, 'BLOCKED_SCRIPT_LOCK_NOT_ACQUIRED'],
    ['kill switch', { props: props({ D7_E_KILL_SWITCH: 'ON' }) }, 'BLOCKED_D7_E_KILL_SWITCH_ACTIVE'],
    ['lease conflict', { leaseStore: { acquireLease: async () => ({ status: 'ACTIVE_LEASE_FOUND', mutationCount: 0 }), releaseLease: async () => ({ status: 'CONFIRMED', mutationCount: 0 }) } }, 'BLOCKED_ACTIVE_LEASE'],
  ];

  for (const [name, options, expected] of cases) {
    const h = makeHarness(options);
    const result = fromVm(await h.runner.run());
    assert.equal(result.D7_E_STATUS, expected, name);
    assert.equal(result.PRODUCTION_MUTATION, 'NONE', name);
    assert.equal(result.DRIVE_MUTATION_COUNT, 0, name);
    assert.equal(result.SHEETS_MUTATION_COUNT, 0, name);
  }

  assert.throws(
    () => gas.call('assertD7EObservedMutationBudget_', {
      DRIVE_FILES_CREATED: 3,
      SHEETS_ROWS_APPENDED: 0,
      SHEETS_ROWS_UPDATED: 0,
      FIRESTORE_JOBS_CREATED: 0,
      FIRESTORE_ATTACHMENT_RECORDS_CREATED: 0,
      FIRESTORE_TOTAL_WRITE_OPERATIONS: 0,
    }),
    /BLOCKED_D7_E_DRIVE_FILE_BUDGET_EXCEEDED/
  );
});

test('partial Drive, Sheet, Firestore, and reconciliation failures preserve bounded evidence', async () => {
  const drive = makeDrive();
  let driveCreates = 0;
  const failingDrive = {
    ...drive,
    mutate: {
      ...drive.mutate,
      async createFileIfAbsent(request) {
        driveCreates += 1;
        if (driveCreates === 2) {
          const error = new Error('D7_E_SYNTHETIC_PDF_FAILURE');
          error.code = 'D7_E_SYNTHETIC_PDF_FAILURE';
          throw error;
        }
        return drive.mutate.createFileIfAbsent(request);
      },
    },
  };
  const driveFailure = makeHarness({ drive: failingDrive });
  const driveResult = fromVm(await driveFailure.runner.run());
  assert.equal(driveResult.D7_E_STATUS, 'D7_E_SYNTHETIC_PDF_FAILURE');
  assert.equal(driveResult.DRIVE_FILES_CREATED, 1);
  assert.equal(driveResult.SHEETS_ROWS_APPENDED, 0);
  assert.equal(driveResult.RECONCILIATION_STATUS, 'RECONCILIATION_REQUIRED');
  assert.equal(driveResult.LEASE_FINAL_STATUS, 'RECONCILIATION_REQUIRED');

  const sheets = makeSheets();
  const failingSheets = {
    ...sheets,
    mutate: {
      ...sheets.mutate,
      async appendImmutableTransactionsIfAbsent() {
        const error = new Error('D7_E_SYNTHETIC_SHEET_FAILURE');
        error.code = 'D7_E_SYNTHETIC_SHEET_FAILURE';
        throw error;
      },
    },
  };
  const sheetFailure = makeHarness({ sheets: failingSheets });
  const sheetResult = fromVm(await sheetFailure.runner.run());
  assert.equal(sheetResult.D7_E_STATUS, 'D7_E_SYNTHETIC_SHEET_FAILURE');
  assert.equal(sheetResult.DRIVE_FILES_CREATED, 2);
  assert.equal(sheetResult.SHEETS_ROWS_APPENDED, 0);
  assert.equal(sheetResult.RECONCILIATION_STATUS, 'RECONCILIATION_REQUIRED');

  const transitionBase = makeHarness();
  let transitionCount = 0;
  const failingJobStore = {
    ...transitionBase.jobStore,
    async transitionJob(request) {
      transitionCount += 1;
      if (transitionCount === 1) {
        const error = new Error('D7_E_SYNTHETIC_TRANSITION_FAILURE');
        error.code = 'D7_E_SYNTHETIC_TRANSITION_FAILURE';
        throw error;
      }
      return transitionBase.jobStore.transitionJob(request);
    },
  };
  const transitionFailure = makeHarness({
    transport: transitionBase.transport,
    jobStore: failingJobStore,
    leaseStore: transitionBase.leaseStore,
    drive: transitionBase.drive,
    sheets: transitionBase.sheets,
  });
  const transitionResult = fromVm(await transitionFailure.runner.run());
  assert.equal(transitionResult.D7_E_STATUS, 'D7_E_SYNTHETIC_TRANSITION_FAILURE');
  assert.equal(transitionResult.DRIVE_FILES_CREATED, 2);
  assert.equal(transitionResult.SHEETS_ROWS_APPENDED, 0);
  assert.equal(transitionResult.RECONCILIATION_STATUS, 'RECONCILIATION_REQUIRED');

  const reconciliationBase = makeHarness();
  const failingReconciliationStore = {
    ...reconciliationBase.jobStore,
    async saveReconciliationReport() {
      const error = new Error('D7_E_SYNTHETIC_RECONCILIATION_FAILURE');
      error.code = 'D7_E_SYNTHETIC_RECONCILIATION_FAILURE';
      throw error;
    },
  };
  const reconciliationFailure = makeHarness({
    transport: reconciliationBase.transport,
    jobStore: failingReconciliationStore,
    leaseStore: reconciliationBase.leaseStore,
    drive: reconciliationBase.drive,
    sheets: failingSheets,
  });
  const reconciliationResult = fromVm(await reconciliationFailure.runner.run());
  assert.equal(reconciliationResult.RECONCILIATION_STATUS, 'RECONCILIATION_MARK_ATTEMPTED_BUT_UNCONFIRMED');
  assert.equal(reconciliationResult.SHEETS_WRITE_OUTCOME_UNKNOWN_COUNT, 1);
  assert.equal(reconciliationResult.PRODUCTION_MUTATION, 'OUTCOME_UNKNOWN');
});

test('Drive persist-then-throw reports write outcome unknown without fabricating confirmation', async () => {
  const drive = makeDrive();
  const failingDrive = {
    ...drive,
    mutate: {
      ...drive.mutate,
      async createFileIfAbsent(request) {
        await drive.mutate.createFileIfAbsent(request);
        const error = new Error('D7_E_SYNTHETIC_DRIVE_RESPONSE_LOST');
        error.code = 'D7_E_SYNTHETIC_DRIVE_RESPONSE_LOST';
        error.writeSubsystem = 'DRIVE';
        error.writeOutcome = 'OUTCOME_UNKNOWN';
        throw error;
      },
    },
  };
  const h = makeHarness({ drive: failingDrive });
  const result = fromVm(await h.runner.run());
  assert.equal(result.D7_E_STATUS, 'D7_E_SYNTHETIC_DRIVE_RESPONSE_LOST');
  assert.equal(h.drive.state.files.length, 1);
  assert.equal(h.drive.state.mutationLog.length, 1);
  assert.equal(result.DRIVE_MUTATION_COUNT, 0);
  assert.equal(result.DRIVE_FILES_CREATED, 0);
  assert.equal(result.DRIVE_WRITE_OUTCOME_UNKNOWN_COUNT, 1);
  assert.equal(result.PRODUCTION_MUTATION_OUTCOME_UNKNOWN, 'YES');
  assert.equal(result.PRODUCTION_MUTATION, 'OUTCOME_UNKNOWN');
});

test('Sheets persist-then-throw reports write outcome unknown without fabricating confirmation', async () => {
  const sheets = makeSheets();
  const failingSheets = {
    ...sheets,
    mutate: {
      ...sheets.mutate,
      async appendImmutableTransactionsIfAbsent(request) {
        await sheets.mutate.appendImmutableTransactionsIfAbsent(request);
        const error = new Error('D7_E_SYNTHETIC_SHEETS_RESPONSE_LOST');
        error.code = 'D7_E_SYNTHETIC_SHEETS_RESPONSE_LOST';
        error.writeSubsystem = 'SHEETS';
        error.writeOutcome = 'OUTCOME_UNKNOWN';
        throw error;
      },
    },
  };
  const h = makeHarness({ sheets: failingSheets });
  const result = fromVm(await h.runner.run());
  assert.equal(result.D7_E_STATUS, 'D7_E_SYNTHETIC_SHEETS_RESPONSE_LOST');
  assert.equal(h.sheets.state.ledgerRows.length, 1);
  assert.equal(h.sheets.state.mutationLog.length, 1);
  assert.equal(result.SHEETS_MUTATION_COUNT, 0);
  assert.equal(result.SHEETS_ROWS_APPENDED, 0);
  assert.equal(result.SHEETS_WRITE_OUTCOME_UNKNOWN_COUNT, 1);
  assert.equal(result.PRODUCTION_MUTATION_OUTCOME_UNKNOWN, 'YES');
  assert.equal(result.PRODUCTION_MUTATION, 'OUTCOME_UNKNOWN');
});

test('Firestore persist-then-throw reports write outcome unknown without fabricating job confirmation', async () => {
  const transport = createFakeFirestoreTransport({
    failures: [{ op: 'createDocument', timing: 'after', pathIncludes: 'invoiceJobs' }],
  });
  const h = makeHarness({ transport });
  const result = fromVm(await h.runner.run());
  assert.equal(result.D7_E_STATUS, 'FIRESTORE_WRITE_UNCONFIRMED');
  const dump = fromVm(transport.dump());
  assert.equal(dump.some(([path]) => path === `invoiceJobs/${JOB_ID}`), true);
  assert.equal(result.FIRESTORE_JOBS_CREATED, 0);
  assert.equal(result.FIRESTORE_JOB_WRITE_COUNT, 0);
  assert.equal(result.FIRESTORE_WRITE_OUTCOME_UNKNOWN_COUNT, 1);
  assert.equal(result.PRODUCTION_MUTATION_OUTCOME_UNKNOWN, 'YES');
  assert.equal(result.PRODUCTION_MUTATION, 'OUTCOME_UNKNOWN');
});

test('write outcome controls avoid false-positive unknown classification', async () => {
  const driveMissingMutate = makeHarness({ drive: { read: makeDrive().read } });
  const driveMissingResult = fromVm(await driveMissingMutate.runner.run());
  assert.equal(driveMissingResult.D7_E_STATUS, 'BLOCKED_D7_E_DRIVE_ADAPTER_MISSING');
  assert.equal(driveMissingResult.DRIVE_WRITE_OUTCOME_UNKNOWN_COUNT, 0);

  const driveConfirmedNotWrittenBase = makeDrive();
  const driveConfirmedNotWritten = makeHarness({
    drive: {
      ...driveConfirmedNotWrittenBase,
      mutate: {
        ...driveConfirmedNotWrittenBase.mutate,
        async createFileIfAbsent() {
          const error = new Error('D7_E_SYNTHETIC_DRIVE_CONFIRMED_NOT_WRITTEN');
          error.code = 'D7_E_SYNTHETIC_DRIVE_CONFIRMED_NOT_WRITTEN';
          error.writeSubsystem = 'DRIVE';
          error.writeOutcome = 'CONFIRMED_NOT_WRITTEN';
          throw error;
        },
      },
    },
  });
  const driveConfirmedNotWrittenResult = fromVm(await driveConfirmedNotWritten.runner.run());
  assert.equal(driveConfirmedNotWrittenResult.DRIVE_XML_STATUS, 'CONFIRMED_NOT_WRITTEN');
  assert.equal(driveConfirmedNotWrittenResult.DRIVE_WRITE_OUTCOME_UNKNOWN_COUNT, 0);

  const driveReadbackBase = makeDrive();
  const driveReadback = makeHarness({
    drive: {
      ...driveReadbackBase,
      read: {
        ...driveReadbackBase.read,
        async readFileMetadata() {
          const error = new Error('D7_E_SYNTHETIC_DRIVE_READBACK_LOSS');
          error.code = 'D7_E_SYNTHETIC_DRIVE_READBACK_LOSS';
          throw error;
        },
      },
    },
  });
  const driveReadbackResult = fromVm(await driveReadback.runner.run());
  assert.equal(driveReadbackResult.DRIVE_WRITE_OUTCOME_UNKNOWN_COUNT, 0);
  assert.equal(driveReadbackResult.DRIVE_MUTATION_COUNT, 2);
  assert.equal(driveReadbackResult.DRIVE_FILES_CREATED, 2);

  const sheetsMissingMutate = makeHarness({ sheets: { read: makeSheets().read } });
  const sheetsMissingResult = fromVm(await sheetsMissingMutate.runner.run());
  assert.equal(sheetsMissingResult.D7_E_STATUS, 'BLOCKED_D7_E_SHEETS_ADAPTER_MISSING');
  assert.equal(sheetsMissingResult.SHEETS_WRITE_OUTCOME_UNKNOWN_COUNT, 0);

  const sheetsConfirmedNotWrittenBase = makeSheets();
  const sheetsConfirmedNotWritten = makeHarness({
    sheets: {
      ...sheetsConfirmedNotWrittenBase,
      mutate: {
        ...sheetsConfirmedNotWrittenBase.mutate,
        async appendImmutableTransactionsIfAbsent() {
          const error = new Error('D7_E_SYNTHETIC_SHEETS_CONFIRMED_NOT_WRITTEN');
          error.code = 'D7_E_SYNTHETIC_SHEETS_CONFIRMED_NOT_WRITTEN';
          error.writeSubsystem = 'SHEETS';
          error.writeOutcome = 'CONFIRMED_NOT_WRITTEN';
          throw error;
        },
      },
    },
  });
  const sheetsConfirmedNotWrittenResult = fromVm(await sheetsConfirmedNotWritten.runner.run());
  assert.equal(sheetsConfirmedNotWrittenResult.SHEETS_TRANSACTION_STATUS, 'CONFIRMED_NOT_WRITTEN');
  assert.equal(sheetsConfirmedNotWrittenResult.SHEETS_WRITE_OUTCOME_UNKNOWN_COUNT, 0);

  const sheetsReadbackBase = makeSheets();
  const sheetsReadback = makeHarness({
    sheets: {
      ...sheetsReadbackBase,
      read: {
        ...sheetsReadbackBase.read,
        async findTransactionByIdentity() {
          const error = new Error('D7_E_SYNTHETIC_SHEETS_READBACK_LOSS');
          error.code = 'D7_E_SYNTHETIC_SHEETS_READBACK_LOSS';
          throw error;
        },
      },
    },
  });
  const sheetsReadbackResult = fromVm(await sheetsReadback.runner.run());
  assert.equal(sheetsReadbackResult.SHEETS_WRITE_OUTCOME_UNKNOWN_COUNT, 0);
  assert.equal(sheetsReadbackResult.SHEETS_MUTATION_COUNT, 1);
  assert.equal(sheetsReadbackResult.SHEETS_ROWS_APPENDED, 1);

  const preWriteTransport = createFakeFirestoreTransport({
    failures: [{ op: 'createDocument', timing: 'before', pathIncludes: 'invoiceJobs' }],
  });
  const firestorePreWrite = makeHarness({ transport: preWriteTransport });
  const firestorePreWriteResult = fromVm(await firestorePreWrite.runner.run());
  assert.equal(firestorePreWriteResult.D7_E_STATUS, 'FIRESTORE_TRANSPORT_ERROR');
  assert.equal(fromVm(preWriteTransport.dump()).some(([path]) => path === `invoiceJobs/${JOB_ID}`), false);
  assert.equal(firestorePreWriteResult.FIRESTORE_WRITE_OUTCOME_UNKNOWN_COUNT, 0);

  const firestoreConfirmedNotWrittenBase = makeHarness();
  const firestoreConfirmedNotWrittenJobStore = {
    ...firestoreConfirmedNotWrittenBase.jobStore,
    async createJobIfAbsent() {
      const error = new Error('D7_E_SYNTHETIC_FIRESTORE_CONFIRMED_NOT_WRITTEN');
      error.code = 'D7_E_SYNTHETIC_FIRESTORE_CONFIRMED_NOT_WRITTEN';
      error.writeSubsystem = 'FIRESTORE';
      error.writeOutcome = 'CONFIRMED_NOT_WRITTEN';
      throw error;
    },
  };
  const firestoreConfirmedNotWritten = makeHarness({
    transport: firestoreConfirmedNotWrittenBase.transport,
    jobStore: firestoreConfirmedNotWrittenJobStore,
    leaseStore: firestoreConfirmedNotWrittenBase.leaseStore,
    drive: firestoreConfirmedNotWrittenBase.drive,
    sheets: firestoreConfirmedNotWrittenBase.sheets,
  });
  const firestoreConfirmedNotWrittenResult = fromVm(await firestoreConfirmedNotWritten.runner.run());
  assert.equal(firestoreConfirmedNotWrittenResult.D7_E_STATUS, 'D7_E_SYNTHETIC_FIRESTORE_CONFIRMED_NOT_WRITTEN');
  assert.equal(firestoreConfirmedNotWrittenResult.FIRESTORE_WRITE_OUTCOME_UNKNOWN_COUNT, 0);
});

test('completed rerun is an idempotent no-op and reconciliation-required state blocks retry', async () => {
  const h = makeHarness();
  const first = fromVm(await h.runner.run());
  assert.equal(first.D7_E_STATUS, 'PASS_ONE_CANDIDATE_PRODUCTION_PILOT_COMPLETED');
  const duplicatePrecheck = precheck({
    summary: {
      D7_B_STATUS: 'BLOCKED_EXACT_DUPLICATE',
      GMAIL_DUPLICATE_STATUS: 'EXACT_DUPLICATE',
      DRIVE_DUPLICATE_STATUS: 'EXACT_DUPLICATE',
      SHEET_DUPLICATE_STATUS: 'EXACT_DUPLICATE',
      FIRESTORE_DUPLICATE_STATUS: 'EXACT_DUPLICATE',
    },
  });
  const second = makeHarness({
    transport: h.transport,
    jobStore: h.jobStore,
    leaseStore: h.leaseStore,
    drive: h.drive,
    sheets: h.sheets,
    precheck: duplicatePrecheck,
  });
  const result = fromVm(await second.runner.run());
  assert.equal(result.D7_E_STATUS, 'PASS_ALREADY_COMPLETED_IDEMPOTENT_NOOP');
  assert.equal(result.DRIVE_FILES_CREATED, 0);
  assert.equal(result.SHEETS_ROWS_APPENDED, 0);
  assert.equal(result.FIRESTORE_TOTAL_WRITE_OPERATIONS, 0);
  assert.equal(h.drive.state.files.length, 2);
  assert.equal(h.sheets.state.ledgerRows.length, 1);

  const partialDrive = makeDrive();
  let partialCreates = 0;
  const failingDrive = {
    ...partialDrive,
    mutate: {
      ...partialDrive.mutate,
      async createFileIfAbsent(request) {
        partialCreates += 1;
        if (partialCreates === 2) {
          const error = new Error('D7_E_SYNTHETIC_PARTIAL_PDF_FAILURE');
          error.code = 'D7_E_SYNTHETIC_PARTIAL_PDF_FAILURE';
          throw error;
        }
        return partialDrive.mutate.createFileIfAbsent(request);
      },
    },
  };
  const partial = makeHarness({ drive: failingDrive });
  const partialResult = fromVm(await partial.runner.run());
  assert.equal(partialResult.RECONCILIATION_STATUS, 'RECONCILIATION_REQUIRED');
  const retry = makeHarness({
    transport: partial.transport,
    jobStore: partial.jobStore,
    leaseStore: partial.leaseStore,
    drive: partial.drive,
    sheets: partial.sheets,
  });
  const retryResult = fromVm(await retry.runner.run());
  assert.equal(retryResult.D7_E_STATUS, 'BLOCKED_RECONCILIATION_REQUIRED');
  assert.equal(retryResult.DRIVE_FILES_CREATED, 0);
  assert.equal(retryResult.SHEETS_ROWS_APPENDED, 0);
});

test('same deterministic job with different stored identity blocks before lease or external writes', async () => {
  const jobStore = {
    async getJob() {
      return {
        jobId: JOB_ID,
        status: 'VALIDATED',
        invoiceIdentityHash: 'different',
        version: 1,
      };
    },
    async createJobIfAbsent() {
      throw new Error('SHOULD_NOT_CREATE_JOB');
    },
  };
  const h = makeHarness({ jobStore });
  const result = fromVm(await h.runner.run());
  assert.equal(result.D7_E_STATUS, 'BLOCKED_DIFFERENT_IDENTITY_EXISTING_JOB');
  assert.equal(result.LEASE_STATUS, 'NOT_ATTEMPTED');
  assertNoExternalMutation(h);
});

test('D7-E source privacy and historical D6J boundary are enforced by source shape', () => {
  const runtime = fs.readFileSync('D7_E_OwnerApprovedOneCandidateProductionPilot.js', 'utf8');
  const d6j = fs.readFileSync('d6jCOneRecordProductionMutation.js', 'utf8');
  assert.match(d6j, /function runD6jCOneRecordProductionMutation\(\) \{\s*return blockD6kHistoricalPhaseEntrypoint_/);
  assert.doesNotMatch(runtime, /runD6jCOneRecordProductionMutation\s*\(/);
  for (const forbidden of [
    'ScriptApp.newTrigger',
    'ScriptApp.deleteTrigger',
    '.setProperty(',
    '.deleteProperty(',
    '.createFolder(',
    '.appendRow(',
    '.setValue(',
    '.setValues(',
    '.deleteRow(',
    '.clear(',
    '.setTrashed(',
  ]) {
    assert.equal(runtime.includes(forbidden), false, forbidden);
  }
  assert.match(runtime, /D7_E_MAX_GMAIL_LABEL_MUTATIONS_\s*=\s*0/);
  assert.match(runtime, /D7_E_MAX_FIRESTORE_TOTAL_WRITE_OPERATIONS_\s*=\s*16/);
  assert.match(runtime, /BLOCKED_OLD_D6J_MARKER_CANNOT_AUTHORIZE_D7_E/);
  assert.match(runtime, /sanitizeD7EString_/);
});
