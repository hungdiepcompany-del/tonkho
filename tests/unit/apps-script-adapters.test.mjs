import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'sgdsAdapterErrors.js',
    'sgdsGmailAdapter.js',
    'sgdsDriveAdapter.js',
    'sgdsSheetsLedgerAdapter.js',
    'sgdsRuntimeAdapterFactory.js'
  ],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: [
    'sgdsAdapterErrors.js',
    'sgdsGmailAdapter.js',
    'sgdsDriveAdapter.js',
    'sgdsSheetsLedgerAdapter.js',
    'sgdsRuntimeAdapterFactory.js',
    'firestoreDataContract.js',
    'firestoreRestGateway.js'
  ],
  exportNames: [
    'SGDS_GMAIL_ADAPTER_CONTRACT_',
    'SGDS_DRIVE_ADAPTER_CONTRACT_',
    'SGDS_SHEETS_LEDGER_ADAPTER_CONTRACT_',
    'SGDS_DEFAULT_PRODUCTION_RUNTIME_',
    'SGDS_CLOUD_RUN_FALLBACK_AUTOMATIC_',
    'SGDS_ADAPTER_ERROR_CODES_',
    'classifySgdsAdapterRetry_',
    'normalizeSgdsAdapterError_',
    'createFakeSgdsGmailAdapter_',
    'createFakeSgdsDriveAdapter_',
    'createFakeSgdsSheetsLedgerAdapter_',
    'createSgdsGmailJobCandidates_',
    'buildSgdsDriveArtifactIdentity_',
    'createSgdsRuntimeAdapterFactory_',
    'createSgdsLocalFakeAdapterSuite_',
    'createSgdsFirestoreGateway_',
    'SGDS_D6_SCHEMA_VERSION_'
  ]
});

const fromVm = (value) => JSON.parse(JSON.stringify(value));

function makeThread() {
  return {
    threadId: 'thread_bundle_c_safe_hash',
    historyId: 'h1',
    labels: ['SGDS/PENDING'],
    messages: [
      {
        messageId: 'msg-1',
        threadId: 'thread_bundle_c_safe_hash',
        order: 1,
        internalDate: '2026-02-01T03:26:41.000Z',
        sender: 'sender@example.test',
        recipients: ['receiver@example.test'],
        subject: 'sanitized invoice thread',
        plainTextBody: 'x'.repeat(700),
        attachments: [
          { attachmentId: 'att-xml-1', fileName: 'same-name.xml', mimeType: 'application/xml', contentHash: 'xml-hash-1', byteSize: 1200, bytes: '<xml>one</xml>' },
          { attachmentId: 'att-pdf-1', fileName: 'same-name.pdf', mimeType: 'application/pdf', contentHash: 'pdf-hash-1', byteSize: 2200 }
        ]
      },
      {
        messageId: 'msg-2',
        threadId: 'thread_bundle_c_safe_hash',
        order: 2,
        internalDate: '2026-02-01T03:27:41.000Z',
        sender: 'sender@example.test',
        recipients: ['receiver@example.test'],
        subject: 'sanitized adjustment invoice',
        semanticType: 'adjustment',
        attachments: [
          { attachmentId: 'att-xml-2', fileName: 'same-name.xml', mimeType: 'application/xml', contentHash: 'xml-hash-2', byteSize: 1300 }
        ]
      },
      {
        messageId: 'msg-3',
        threadId: 'thread_bundle_c_safe_hash',
        order: 3,
        internalDate: '2026-02-01T03:28:41.000Z',
        sender: 'sender@example.test',
        recipients: ['receiver@example.test'],
        subject: 'sanitized pdf only invoice',
        attachments: [
          { attachmentId: 'att-pdf-only', fileName: 'pdf-only.pdf', mimeType: 'application/pdf', contentHash: 'pdf-only-hash', byteSize: 1500 }
        ]
      },
      {
        messageId: 'msg-4',
        threadId: 'thread_bundle_c_safe_hash',
        order: 4,
        internalDate: '2026-02-01T03:29:41.000Z',
        sender: 'sender@example.test',
        recipients: ['receiver@example.test'],
        subject: 'sanitized link invoice',
        attachments: [
          { attachmentId: 'att-link-only', fileName: 'invoice.html', mimeType: 'text/html', contentHash: 'link-hash', byteSize: 500 }
        ]
      }
    ]
  };
}

function makeLedgerLine(overrides = {}) {
  return {
    issueDate: '2026-02-01',
    legacyInvoiceKey: '20260201_0100000001_C26THD8',
    invoiceKeyV2: '0100000001_C26THD8_8_20260201',
    sourceLineNo: 1,
    lineIdentityV2: 'line-v2-1',
    transactionIdentity: 'line-v2-1',
    direction: 'NHAP',
    itemCode: 'ITEM-1',
    itemName: 'Item 1',
    quantity: 1,
    unitPrice: 100,
    ...overrides
  };
}

function createFakeHttpTransport() {
  const docs = new Map();
  const calls = [];
  function urlToPath(url) {
    const clean = String(url).split('?')[0];
    const marker = '/documents/';
    return decodeURIComponent(clean.slice(clean.indexOf(marker) + marker.length));
  }
  return {
    docs,
    calls,
    async transport(request) {
      calls.push({ method: request.method, url: request.url, hasAuthorization: Boolean(request.headers && request.headers.Authorization) });
      const path = urlToPath(request.url);
      if (request.method === 'GET') return docs.has(path) ? { status: 200, body: JSON.stringify(docs.get(path)) } : { status: 404, body: 'missing' };
      if (request.method === 'POST') {
        const doc = JSON.parse(request.body);
        docs.set(path, doc);
        return { status: 200, body: JSON.stringify(doc) };
      }
      if (request.method === 'PATCH') {
        const current = docs.get(path) || { fields: {} };
        const patch = JSON.parse(request.body);
        const next = { fields: { ...current.fields, ...patch.fields } };
        docs.set(path, next);
        return { status: 200, body: JSON.stringify(next) };
      }
      return { status: 400, body: 'unsupported' };
    }
  };
}

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

test('D6C Gmail adapter normalizes JSON-safe DTOs and separates reads from mutations', async () => {
  const fake = gas.call('createFakeSgdsGmailAdapter_', { threads: [makeThread()] });
  const threads = fromVm(await fake.read.searchCandidateThreads({ query: 'label:safe', limit: 1 }));
  assert.equal(threads.length, 1);
  assert.equal(threads[0].messageCount, 4);
  assert.equal(threads[0].messages[0].bodyPreview.length, 500);
  assert.equal(threads[0].messages[0].attachments[0].artifactType, 'XML');
  assert.equal(fake.state.mutationLog.length, 0);

  const labelsBefore = fromVm(await fake.read.readLabels({ threadId: 'thread_bundle_c_safe_hash' }));
  assert.deepEqual(labelsBefore, ['SGDS/PENDING']);
  await fake.mutate.applyProcessingLabel({ threadId: 'thread_bundle_c_safe_hash', labelName: 'SGDS/SAVED', idempotencyKey: 'gmail-label-1' });
  const labelsAfter = fromVm(await fake.read.readLabels({ threadId: 'thread_bundle_c_safe_hash' }));
  assert.deepEqual(labelsAfter, ['SGDS/PENDING', 'SGDS/SAVED']);
  assert.deepEqual(fromVm(fake.state.mutationLog).map(item => item.method), ['applyProcessingLabel']);
});

test('D6C Gmail candidate extraction preserves XML and marks PDF-only/link-only for review', async () => {
  const fake = gas.call('createFakeSgdsGmailAdapter_', { threads: [makeThread()] });
  const thread = await fake.read.readThreadMetadata({ threadId: 'thread_bundle_c_safe_hash' });
  const candidates = fromVm(gas.call('createSgdsGmailJobCandidates_', thread));
  assert.equal(candidates.filter(item => item.attachmentKind === 'XML').length, 2);
  assert.equal(candidates.some(item => item.reviewReason === 'PDF_ONLY_REVIEW_REQUIRED'), true);
  assert.equal(candidates.some(item => item.reviewReason === 'LINK_ONLY_REVIEW_REQUIRED'), true);
  assert.equal(new Set(candidates.map(item => item.invoiceJobIdentity)).size, candidates.length);
});

test('D6D Drive adapter uses deterministic identity instead of filename-only deduplication', async () => {
  const fake = gas.call('createFakeSgdsDriveAdapter_', {});
  const folder = await fake.mutate.ensureFolder({ direction: 'NHAP', year: '2026', artifactType: 'XML', idempotencyKey: 'folder-1' });
  assert.equal(fromVm(folder).exists, true);
  const common = { direction: 'NHAP', year: '2026', artifactType: 'XML', fileName: 'same-name.xml', mimeType: 'application/xml', invoiceKeyV2: 'inv-1', messageId: 'msg-1', attachmentId: 'att-1', byteSize: 100 };
  const first = fromVm(await fake.mutate.createFileIfAbsent({ ...common, contentHash: 'hash-a', idempotencyKey: 'file-1' }));
  const replay = fromVm(await fake.mutate.createFileIfAbsent({ ...common, contentHash: 'hash-a', idempotencyKey: 'file-1-replay' }));
  const second = fromVm(await fake.mutate.createFileIfAbsent({ ...common, attachmentId: 'att-2', contentHash: 'hash-b', idempotencyKey: 'file-2' }));
  assert.equal(first.status, 'CONFIRMED_WRITTEN');
  assert.equal(replay.status, 'ALREADY_PRESENT');
  assert.notEqual(first.logicalFileIdentity, second.logicalFileIdentity);
  assert.equal(fake.state.files.length, 2);
});

test('D6D Drive read-only operations do not create folders or files', async () => {
  const fake = gas.call('createFakeSgdsDriveAdapter_', {});
  const folder = fromVm(await fake.read.findFolder({ direction: 'NHAP', year: '2026', artifactType: 'PDF' }));
  const file = fromVm(await fake.read.findFileByIdentity({ invoiceKeyV2: 'inv', messageId: 'msg', attachmentId: 'att', contentHash: 'hash', artifactType: 'PDF' }));
  assert.equal(folder.exists, false);
  assert.equal(file.exists, false);
  assert.deepEqual(fromVm(fake.state.mutationLog), []);
});

test('D6E Sheets adapter preserves append-only immutable transaction history', async () => {
  const fake = gas.call('createFakeSgdsSheetsLedgerAdapter_', { inventory: { 'ITEM-1': 1 } });
  const first = fromVm(await fake.mutate.appendImmutableTransactionsIfAbsent({ rows: [makeLedgerLine()], idempotencyKey: 'ledger-1' }));
  const replay = fromVm(await fake.mutate.appendImmutableTransactionsIfAbsent({ rows: [makeLedgerLine()], idempotencyKey: 'ledger-1-replay' }));
  const priceVariant = fromVm(await fake.mutate.appendImmutableTransactionsIfAbsent({
    rows: [makeLedgerLine({ sourceLineNo: 2, lineIdentityV2: 'line-v2-2', transactionIdentity: 'line-v2-2', unitPrice: 125 })],
    idempotencyKey: 'ledger-2'
  }));
  assert.equal(first.appendedCount, 1);
  assert.equal(replay.idempotent, true);
  assert.equal(priceVariant.appendedCount, 1);
  assert.deepEqual(fromVm(fake.state.ledgerRows).map(row => row.transactionSequence), [1, 2]);
  assert.throws(() => fake.mutate.updateAnyCell({}), /adapter_contract_error/);
  assert.throws(() => fake.mutate.deleteAnyRow({}), /adapter_contract_error/);
});

test('D6E Sheets adapter blocks oversell and appends adjustment, replacement, and cancellation rows', async () => {
  const fake = gas.call('createFakeSgdsSheetsLedgerAdapter_', { inventory: { 'ITEM-1': 1 } });
  await assert.rejects(fake.mutate.appendImmutableTransactionsIfAbsent({
    rows: [makeLedgerLine({ direction: 'XUAT', quantity: 2 })],
    idempotencyKey: 'oversell'
  }), /adapter_conflict/);
  await fake.mutate.appendAdjustment({ rows: [makeLedgerLine({ transactionIdentity: 'adjust-1', lineIdentityV2: 'adjust-1', quantity: -1 })], idempotencyKey: 'adjust-1' });
  await fake.mutate.appendReplacement({ rows: [makeLedgerLine({ transactionIdentity: 'replace-1', lineIdentityV2: 'replace-1', quantity: 3 })], idempotencyKey: 'replace-1' });
  await fake.mutate.appendCancellation({ rows: [makeLedgerLine({ transactionIdentity: 'cancel-1', lineIdentityV2: 'cancel-1', quantity: 0 })], idempotencyKey: 'cancel-1' });
  assert.deepEqual(fromVm(fake.state.ledgerRows).map(row => row.transactionKind), ['ADJUSTMENT', 'REPLACEMENT', 'CANCELLATION']);
});

test('D6E Sheets rebuild planning starts from earliest affected transaction and supports full rebuild', async () => {
  const fake = gas.call('createFakeSgdsSheetsLedgerAdapter_', {
    ledgerRows: [
      makeLedgerLine({ transactionSequence: 1, transactionIdentity: 'tx-1', lineIdentityV2: 'tx-1' }),
      makeLedgerLine({ transactionSequence: 2, transactionIdentity: 'tx-2', lineIdentityV2: 'tx-2' }),
      makeLedgerLine({ transactionSequence: 3, transactionIdentity: 'tx-3', lineIdentityV2: 'tx-3' })
    ]
  });
  const partial = fromVm(await fake.read.planRebuildFromEarliestAffected({ affectedTransactionIdentities: ['tx-2'] }));
  const full = fromVm(await fake.read.planRebuildFromEarliestAffected({ affectedTransactionIdentities: ['tx-1'] }));
  await fake.mutate.replaceDerivedRangeForRebuild({ startSequence: partial.startSequence, rows: [], idempotencyKey: 'rebuild-1' });
  assert.deepEqual(partial, { startSequence: 2, mode: 'PARTIAL_REBUILD', rowCount: 2 });
  assert.deepEqual(full, { startSequence: 1, mode: 'FULL_REBUILD', rowCount: 3 });
  assert.equal(fromVm(fake.state.derivedRebuilds)[0].startSequence, 2);
});

test('runtime factory defaults to Apps Script and blocks automatic Cloud Run fallback', () => {
  const factory = gas.call('createSgdsRuntimeAdapterFactory_', {
    fakeFactory: () => gas.call('createSgdsLocalFakeAdapterSuite_', { gmail: { threads: [makeThread()] } })
  });
  assert.equal(factory.defaultProductionRuntime, 'apps_script');
  assert.equal(factory.cloudRunFallbackAutomatic, false);
  const suite = factory.createAdapterSuite({ mode: 'fake' });
  assert.equal(fromVm(suite).runtime, 'fake');
  assert.throws(() => factory.createAdapterSuite({ mode: 'cloud_run_optional', automaticFallback: true }), /automatic Cloud Run fallback is forbidden/);
});

test('adapter error taxonomy maps retry and idempotency classes without raw messages', () => {
  assert.equal(gas.call('classifySgdsAdapterRetry_', 'adapter_rate_limited'), 'retryable');
  assert.equal(gas.call('classifySgdsAdapterRetry_', 'adapter_conflict'), 'review-required');
  assert.equal(gas.call('classifySgdsAdapterRetry_', 'adapter_idempotent_replay'), 'idempotent-success');
  const normalized = fromVm(gas.call('normalizeSgdsAdapterError_', { code: 503, message: ['Bearer ', 'abc ', 'ya29', '.synthetic'].join('') }));
  assert.equal(normalized.code, 'adapter_transient_error');
  assert.equal(normalized.retryClass, 'retryable');
  assert.equal(normalized.safeMessage.includes('abc'), false);
  assert.equal(normalized.safeMessage.includes('ya29'), false);
});

test('local end-to-end adapter flow creates Firestore control record, Drive evidence, and Sheets rows without production calls', async () => {
  const suite = gas.call('createSgdsLocalFakeAdapterSuite_', {
    gmail: { threads: [makeThread()] },
    sheets: { inventory: { 'ITEM-1': 10 } }
  });
  const gmailThread = await suite.gmail.read.readThreadMetadata({ threadId: 'thread_bundle_c_safe_hash' });
  const candidates = fromVm(gas.call('createSgdsGmailJobCandidates_', gmailThread));
  const xmlCandidate = candidates.find(item => item.attachmentKind === 'XML');

  const fakeHttp = createFakeHttpTransport();
  const gateway = gas.call('createSgdsFirestoreGateway_', {
    projectId: 'demo-sgds-local',
    databaseId: '(default)',
    baseUrl: 'http://127.0.0.1:9099/v1/projects/demo-sgds-local/databases/(default)/documents',
    accessTokenProvider: async () => 'synthetic-token',
    httpTransport: fakeHttp.transport,
    clock: { now: () => '2026-07-18T00:00:00.000Z' }
  });
  await gateway.jobs.createJob({
    jobId: 'job_d6c_d6e_e2e',
    gmailMessageId: xmlCandidate.messageId,
    threadId: xmlCandidate.threadId,
    status: 'discovered',
    currentStep: 'discovered',
    attemptCount: 0,
    nextRetryAt: null,
    leaseOwner: '',
    leaseExpiresAt: null,
    attachmentIds: [xmlCandidate.attachmentId],
    driveFileIds: [],
    sheetRecordKeys: [],
    idempotencyKey: 'e2e-job-create',
    lastErrorCode: '',
    lastErrorMessage: '',
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
    completedAt: null,
    schemaVersion: gas.exports.SGDS_D6_SCHEMA_VERSION_
  });

  await suite.drive.mutate.ensureFolder({ direction: 'NHAP', year: '2026', artifactType: 'XML', idempotencyKey: 'e2e-folder' });
  const driveFile = fromVm(await suite.drive.mutate.createFileIfAbsent({
    direction: 'NHAP',
    year: '2026',
    artifactType: 'XML',
    fileName: 'same-name.xml',
    mimeType: 'application/xml',
    invoiceKeyV2: '0100000001_C26THD8_8_20260201',
    messageId: xmlCandidate.messageId,
    attachmentId: xmlCandidate.attachmentId,
    contentHash: xmlCandidate.attachmentContentHash,
    byteSize: 1200,
    idempotencyKey: 'e2e-drive'
  }));
  const ledger = fromVm(await suite.sheets.mutate.appendImmutableTransactionsIfAbsent({
    rows: [makeLedgerLine()],
    idempotencyKey: 'e2e-ledger'
  }));
  const replay = fromVm(await suite.sheets.mutate.appendImmutableTransactionsIfAbsent({
    rows: [makeLedgerLine()],
    idempotencyKey: 'e2e-ledger-replay'
  }));

  assert.equal(driveFile.status, 'CONFIRMED_WRITTEN');
  assert.equal(ledger.appendedCount, 1);
  assert.equal(replay.idempotent, true);
  assert.equal(fakeHttp.calls.length, 1);
  assert.equal(fromVm(suite.gmail.state.mutationLog).length, 0);
  assert.equal(fromVm(suite.drive.state.mutationLog).length, 2);
  assert.equal(fromVm(suite.sheets.state.mutationLog).length, 1);
});
