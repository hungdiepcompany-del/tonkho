import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['D7_E4E_ValidatedJobRecoveryRuntime.js', 'Shared_Normalization.js', 'sheetTonKho.js'],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['D7_B_BoundedReadOnlyCandidateDiscovery.js', 'Shared_Normalization.js', 'D7_E4E_ValidatedJobRecoveryRuntime.js'],
  exportNames: [
    'D7_E4E_STATE_PATH_',
    'D7_E4E_CAPABILITIES_',
    'D7_E4E_WRITE_BUDGET_',
    'D7_E4E_OWNER_MARKER_PROPERTY_',
    'D7_E4E_OWNER_MARKER_VALUE_',
    'createD7E4EValidatedJobRecoveryRunner_',
    'createD7E4EExactLeaseStore_',
    'createD7E4EProductionAdapters_',
    'createD7E4EGmailProjectionAdapter_',
    'createD7E4EFreshReadOnlyVerifier_',
    'verifyD7E4EInventoryReadOnly_',
    'assertD7E4EInventorySnapshot_'
  ]
});

const inventoryWriterGas = loadGasSource({
  files: ['Shared_Normalization.js', 'sheetTonKho.js'],
  stubs: { Date }
});

const fromVm = value => JSON.parse(JSON.stringify(value));
const canonicalHash = character => character.repeat(64);
const threadHash = value => createHash('sha256').update(value).digest('hex').slice(0, 16);

function createInventoryWriterFixture(options = {}) {
  const invoiceRows = options.invoiceRows || [
    [1, new Date(2026, 8, 20), '', '', 'SKU-1', '', 'NHAP', 10, 5],
    [2, '2026-09-21', '', '', 'SKU-1', '', 'NHAP', 5, 4],
    [3, '22/09/2026', '', '', 'SKU-1', '', 'NHAP', 3, 7]
  ];
  const itemRows = [['Ma hang', 'Ten hang', 'DVT'], ['SKU-1', 'Item One', 'EA']];
  let inventoryRows = [];
  let updateDate = null;
  let writes = 0;
  const progressStatuses = [];
  const range = () => ({
    clearContent() { return this; },
    setValues(values) { inventoryRows = JSON.parse(JSON.stringify(values)); writes += 1; return this; },
    getValues() { return inventoryRows.map(row => [row[0]]); },
    setFontColors() { return this; },
    setFontFamilies() { return this; },
    setFontSizes() { return this; },
    setFontWeights() { return this; },
    setValue(value) { updateDate = value; return this; },
    setNumberFormat() { return this; }
  });
  const invoiceSheet = {
    getLastRow: () => invoiceRows.length + 1,
    getRange: () => ({ getValues: () => invoiceRows })
  };
  const inventorySheet = {
    getLastRow: () => 1,
    getRange: (...args) => {
      if (args[0] === 'H6') return range();
      if (args[0] === 1) return { getValues: () => [['Ma hang']] };
      return range();
    }
  };
  const itemSheet = {
    getDataRange: () => ({ getValues: () => itemRows }),
    getLastRow: () => itemRows.length,
    getRange: () => ({
      getValues: () => [['SKU-1']],
      getFontColorObjects: () => [[null]],
      getFontFamilies: () => [['Arial']],
      getFontSizes: () => [[10]],
      getFontWeights: () => [['normal']]
    })
  };
  const spreadsheet = {
    getSheetByName(name) {
      return { 'Nhap-Xuat': invoiceSheet, 'TonKho': inventorySheet, 'MaHangHoa': itemSheet }[name] || null;
    },
    toast() {}
  };
  inventoryWriterGas.context.CONFIG = { SHEET_INVOICE: 'Nhap-Xuat', SHEET_TONKHO: 'TonKho', SHEET_ITEMCODE: 'MaHangHoa' };
  inventoryWriterGas.context.ProgressService = { begin: () => 'writer-test', set(_runId, _percent, _message, status) { progressStatuses.push(status || ''); }, get() {} };
  inventoryWriterGas.context.debugLog_ = () => {};
  inventoryWriterGas.context.appendFileLogEntries_ = () => {};
  inventoryWriterGas.context.sanitizeLogValue_ = value => String(value);
  inventoryWriterGas.context.SpreadsheetApp = { getActive: () => spreadsheet };
  return {
    invoiceRows,
    get inventoryRows() { return inventoryRows; },
    get updateDate() { return updateDate; },
    get writes() { return writes; },
    get progressStatuses() { return progressStatuses.slice(); },
    rebuild(cutoff) { return inventoryWriterGas.context.capNhatTonKho(cutoff, 'writer-test'); }
  };
}

function createInventoryReadbackFixture(h6Value) {
  const invoiceRows = [
    [1, '2026-09-20', '', '', 'SKU-1', '', 'NHAP', 10, 5],
    [2, '2026-09-21', '', '', 'SKU-1', '', 'NHAP', 5, 4]
  ];
  const inventoryRows = [
    ['Ma hang', 'Ten hang', 'DVT', 'So luong', 'Gia tri', 'Don gia BQ'],
    ['SKU-1', 'Item One', 'EA', 10, 50, 5]
  ];
  const invoiceSheet = {
    getLastRow: () => invoiceRows.length + 1,
    getRange: () => ({ getValues: () => invoiceRows })
  };
  const inventorySheet = {
    getRange: range => {
      assert.equal(range, 'H6');
      return { getValue: () => h6Value };
    },
    getDataRange: () => ({ getValues: () => inventoryRows })
  };
  const itemSheet = { getDataRange: () => ({ getValues: () => [['Ma hang', 'Ten hang', 'DVT'], ['SKU-1', 'Item One', 'EA']] }) };
  gas.context.CONFIG = { SHEET_INVOICE: 'Nhap-Xuat', SHEET_TONKHO: 'TonKho', SHEET_ITEMCODE: 'MaHangHoa' };
  gas.context.SpreadsheetApp = {
    openById: id => {
      assert.equal(id, 'inventory-readback-sheet');
      return { getSheetByName: name => ({ 'Nhap-Xuat': invoiceSheet, 'TonKho': inventorySheet, 'MaHangHoa': itemSheet }[name] || null) };
    }
  };
  return {
    context: { precheck: { config: { spreadsheetId: 'inventory-readback-sheet' } } },
    plan: { ledgerRows: [{ issueDate: '20/09/2026' }] }
  };
}

function createGmailThread(id, initialLabels, calls) {
  const labels = new Set(initialLabels);
  return {
    getId() { return id; },
    getLabels() { return [...labels].map(name => ({ getName: () => name })); },
    addLabel(label) { calls.push(`add:${id}:${label.getName()}`); labels.add(label.getName()); },
    removeLabel(label) { calls.push(`remove:${id}:${label.getName()}`); labels.delete(label.getName()); }
  };
}

function createFixture(overrides = {}) {
  const calls = [];
  const transitions = [];
  const marker = { available: true, claims: 0 };
  const lease = { reacquires: 0, finalizes: 0 };
  const initialJob = { jobId: 'job-sensitive-identity', status: 'VALIDATED', version: 4, reconciliationStatus: 'RECONCILIATION_REQUIRED' };
  let job = { ...initialJob };

  const authorization = {
    marker: gas.exports.D7_E4E_OWNER_MARKER_VALUE_,
    canonical: {
      candidateFingerprint: canonicalHash('a'),
      invoiceIdentityHash: canonicalHash('a'),
      xmlSha256: canonicalHash('b'),
      pdfSha256: canonicalHash('c'),
      attachmentSetHash: canonicalHash('d')
    },
    rawProperties: {}
  };

  const context = {
    expected: { jobId: initialJob.jobId },
    snapshot: {
      job: { ...initialJob },
      lease: { status: 'RECONCILIATION_REQUIRED', jobId: initialJob.jobId, fencingToken: 'fence-sensitive', leaseGeneration: 2 },
      events: [{}, {}],
      eventsComplete: true
    },
    eligibility: { classification: 'READY_FOR_LOCAL_RUNTIME_IMPLEMENTATION', capabilitySummary: { PASS: 7, FAIL: 0, NOT_PROVEN: 0 } },
    plan: { jobId: initialJob.jobId, ledgerRows: [{ issueDate: '2026-09-21' }] },
    plannedBudget: fromVm(gas.exports.D7_E4E_WRITE_BUDGET_)
  };

  const jobStore = {
    async getJob(id) {
      calls.push('job.get');
      assert.equal(id, initialJob.jobId);
      return { ...job };
    },
    async transitionJob(request) {
      calls.push(`job.${request.fromStatus}>${request.toStatus}`);
      assert.equal(request.jobId, initialJob.jobId);
      assert.equal(request.expectedVersion, job.version);
      assert.equal(request.fromStatus, job.status);
      job = { ...job, ...request.patch, status: request.toStatus, version: job.version + 1 };
      transitions.push(`${request.fromStatus}>${request.toStatus}`);
      return { resultCode: 'JOB_TRANSITIONED', job: { ...job } };
    },
    async appendAuditEvent(request) {
      calls.push('job.audit');
      assert.equal(request.sequence, 3);
      return { resultCode: 'AUDIT_EVENT_APPENDED' };
    }
  };

  const leaseStore = {
    async reacquireReconciliationLease(request) {
      calls.push('lease.reacquire');
      lease.reacquires += 1;
      return {
        status: 'ACTIVE',
        mutationCount: 1,
        lease: { jobId: request.jobId, fencingToken: request.expectedFence, leaseGeneration: request.expectedGeneration + 1 }
      };
    },
    async finalizeReconciliationLease(request) {
      calls.push(`lease.finalize.${request.status}`);
      lease.finalizes += 1;
      return { status: request.status, mutationCount: 1 };
    }
  };

  const adapters = {
    artifacts: {
      async persistAndVerify() { calls.push('adapter.artifacts'); return { status: 'PASS', mutationCount: 2, xmlFileReference: 'xml-ref', pdfFileReference: 'pdf-ref' }; }
    },
    hoaDon: {
      async upsertAndVerify() { calls.push('adapter.hoaDon'); return { status: 'PASS', mutationCount: 1 }; }
    },
    ledger: {
      async appendAndVerify() { calls.push('adapter.ledger'); return { status: 'PASS', mutationCount: 1 }; }
    },
    inventory: {
      async rebuildAndVerify() { calls.push('adapter.inventory'); return { status: 'PASS', mutationCount: 1 }; }
    },
    gmail: {
      async applyAndVerify() { calls.push('adapter.gmail'); return { status: 'PASS', mutationCount: 1 }; }
    },
    async verifyAll() { calls.push('adapter.verifyAll'); return { status: 'PASS' }; }
  };

  const lock = {
    held: false,
    tryLock() { calls.push('lock.acquire'); this.held = true; return true; },
    releaseLock() { calls.push('lock.release'); this.held = false; }
  };

  const deps = {
    async readAuthorization() { calls.push('authorization.read'); return authorization; },
    async inspectRecoveryContext() { calls.push('context.inspect'); return context; },
    markerLifecycle: {
      async claim() {
        calls.push('marker.claim');
        marker.claims += 1;
        if (!marker.available) throw Object.assign(new Error('BLOCKED_D7_E4E_OWNER_MARKER_INVALID'), { code: 'BLOCKED_D7_E4E_OWNER_MARKER_INVALID', writeOutcome: 'CONFIRMED_NOT_WRITTEN' });
        marker.available = false;
        return { status: 'CLAIMED', mutationCount: 1 };
      }
    },
    createJobStore() { return jobStore; },
    createLeaseStore() { return leaseStore; },
    createAdapters() { return adapters; },
    createLock() { return lock; },
    clock: { now: () => '2026-09-22T00:00:00.000Z' },
    logger: { log() {} }
  };

  Object.assign(deps, overrides.deps || {});
  Object.assign(context, overrides.context || {});
  Object.assign(adapters, overrides.adapters || {});
  if (overrides.authorization) Object.assign(authorization, overrides.authorization);
  return { deps, context, authorization, adapters, jobStore, leaseStore, marker, lease, calls, transitions, getJob: () => ({ ...job }) };
}

async function runFixture(fixture) {
  const runner = gas.call('createD7E4EValidatedJobRecoveryRunner_', fixture.deps);
  return fromVm(await runner.run());
}

test('successful recovery preserves the exact job and follows the seven-state path', async () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  const fixture = createFixture();
  const result = await runFixture(fixture);
  assert.equal(result.FINAL_STATUS, 'PASS_D7_E4E_SAME_JOB_RECOVERY_COMPLETED');
  assert.equal(result.FINAL_JOB_STATUS, 'COMPLETED');
  assert.equal(result.STATE_PATH_STATUS, 'PASS_EXACT_PATH');
  assert.deepEqual(fixture.transitions, [
    'VALIDATED>FILES_SAVED',
    'FILES_SAVED>COMMITTING',
    'COMMITTING>ROWS_COMMITTED',
    'ROWS_COMMITTED>INVENTORY_PENDING',
    'INVENTORY_PENDING>PROJECTIONS_COMMITTED',
    'PROJECTIONS_COMMITTED>COMPLETED'
  ]);
  assert.equal(fixture.getJob().jobId, fixture.context.plan.jobId);
  assert.equal(fixture.getJob().version, 10);
  assert.equal(fixture.getJob().reconciliationStatus, 'CONSISTENT');
});

test('all seven capabilities and exact immutable write budget are declared', () => {
  assert.deepEqual(fromVm(gas.exports.D7_E4E_STATE_PATH_), ['VALIDATED', 'FILES_SAVED', 'COMMITTING', 'ROWS_COMMITTED', 'INVENTORY_PENDING', 'PROJECTIONS_COMMITTED', 'COMPLETED']);
  assert.deepEqual(Object.values(fromVm(gas.exports.D7_E4E_CAPABILITIES_)), [true, true, true, true, true, true, true]);
  assert.deepEqual(fromVm(gas.exports.D7_E4E_WRITE_BUDGET_), {
    FIRESTORE_JOB_CREATES: 0,
    FIRESTORE_JOB_TRANSITIONS: 6,
    FIRESTORE_LEASE_UPDATES: 2,
    FIRESTORE_AUDIT_EVENT_CREATES: 1,
    FIRESTORE_ATTACHMENT_CREATES: 0,
    FIRESTORE_RECONCILIATION_REPORT_CREATES: 0,
    FIRESTORE_TOTAL: 9,
    DRIVE_FILE_CREATES: 2,
    HOA_DON_ROW_MUTATIONS: 1,
    LEDGER_ROW_APPENDS: 1,
    INVENTORY_REBUILDS: 1,
    GMAIL_LABEL_MUTATIONS: 1,
    SCRIPT_PROPERTY_MUTATIONS: 1,
    TRIGGER_MUTATIONS: 0,
    DESTRUCTIVE_OPERATIONS: 0
  });
});

test('invalid owner marker fails before lock, marker claim, lease, or adapter mutation', async () => {
  const fixture = createFixture({ authorization: { marker: 'WRONG' } });
  const result = await runFixture(fixture);
  assert.equal(result.FINAL_STATUS, 'BLOCKED_D7_E4E_OWNER_MARKER_INVALID');
  assert.deepEqual(fixture.calls, ['authorization.read']);
  assert.equal(fixture.marker.claims, 0);
  assert.equal(result.COUNTERS.FIRESTORE_TOTAL, 0);
});

test('unproven eligibility fails before consuming the marker', async () => {
  const fixture = createFixture();
  fixture.context.eligibility.classification = 'BLOCKED_RECOVERY_EVIDENCE';
  const result = await runFixture(fixture);
  assert.equal(result.FINAL_STATUS, 'BLOCKED_D7_E4E_ELIGIBILITY_NOT_PROVEN');
  assert.equal(fixture.marker.claims, 0);
  assert.equal(fixture.lease.reacquires, 0);
});

test('same-job identity mismatch fails closed with zero production mutation', async () => {
  const fixture = createFixture();
  fixture.context.plan.jobId = 'different-job';
  const result = await runFixture(fixture);
  assert.equal(result.FINAL_STATUS, 'BLOCKED_D7_E4E_SAME_JOB_IDENTITY_MISMATCH');
  assert.equal(fixture.marker.claims, 0);
  assert.equal(result.COUNTERS.SCRIPT_PROPERTY_MUTATIONS, 0);
});

test('marker is claimed exactly once before lease or external adapters', async () => {
  const fixture = createFixture();
  await runFixture(fixture);
  assert.equal(fixture.marker.claims, 1);
  assert.ok(fixture.calls.indexOf('marker.claim') < fixture.calls.indexOf('lease.reacquire'));
  assert.ok(fixture.calls.indexOf('marker.claim') < fixture.calls.indexOf('adapter.artifacts'));

  const second = await runFixture(fixture);
  assert.equal(second.FINAL_STATUS, 'BLOCKED_D7_E4E_OWNER_MARKER_INVALID');
  assert.equal(fixture.marker.claims, 2);
  assert.equal(fixture.lease.reacquires, 1);
});

test('unknown write outcome enters quarantine and performs no speculative lease finalization', async () => {
  const fixture = createFixture();
  fixture.adapters.ledger.appendAndVerify = async () => {
    fixture.calls.push('adapter.ledger.unknown');
    const error = new Error('WRITE_OUTCOME_UNKNOWN');
    error.code = 'WRITE_OUTCOME_UNKNOWN';
    error.writeOutcome = 'UNKNOWN';
    throw error;
  };
  const result = await runFixture(fixture);
  assert.equal(result.FINAL_STATUS, 'PENDING_LATE_COMPLETION_QUARANTINE');
  assert.equal(fixture.lease.finalizes, 0);
  assert.equal(fixture.calls.includes('adapter.inventory'), false);
  assert.equal(fixture.calls.includes('adapter.gmail'), false);
});

test('native adapter exception is quarantined because a committed write cannot be excluded', async () => {
  const fixture = createFixture();
  fixture.adapters.ledger.appendAndVerify = async () => {
    fixture.calls.push('adapter.ledger.native-error');
    throw new Error('transport response lost');
  };
  const result = await runFixture(fixture);
  assert.equal(result.FINAL_STATUS, 'PENDING_LATE_COMPLETION_QUARANTINE');
  assert.equal(result.BLOCKER_CODE, 'BLOCKED_D7_E4E_WRITE_OUTCOME_UNKNOWN');
  assert.equal(fixture.lease.finalizes, 0);
});

for (const [name, response] of [
  ['null', null],
  ['blocked', { status: 'BLOCKED', mutationCount: 0 }],
  ['not-confirmed', { status: 'NOT_CONFIRMED' }]
]) {
  test(`resolved ${name} adapter response is quarantined before a durable transition`, async () => {
    const fixture = createFixture();
    fixture.adapters.artifacts.persistAndVerify = async () => response;
    const result = await runFixture(fixture);
    assert.equal(result.FINAL_STATUS, 'PENDING_LATE_COMPLETION_QUARANTINE');
    assert.equal(result.BLOCKER_CODE, 'BLOCKED_D7_E4E_DRIVE_ARTIFACTS_MUTATION_NOT_CONFIRMED');
    assert.equal(fixture.transitions.length, 0);
    assert.equal(fixture.lease.finalizes, 0);
  });
}

test('resolved unconfirmed later adapter response cannot advance its next transition', async () => {
  const fixture = createFixture();
  fixture.adapters.ledger.appendAndVerify = async () => ({ status: 'NOT_CONFIRMED', mutationCount: 0 });
  const result = await runFixture(fixture);
  assert.equal(result.FINAL_STATUS, 'PENDING_LATE_COMPLETION_QUARANTINE');
  assert.equal(result.BLOCKER_CODE, 'BLOCKED_D7_E4E_LEDGER_MUTATION_NOT_CONFIRMED');
  assert.deepEqual(fixture.transitions, ['VALIDATED>FILES_SAVED', 'FILES_SAVED>COMMITTING']);
  assert.equal(fixture.lease.finalizes, 0);
});

for (const [name, mutationCount] of [['missing', undefined], ['null', null], ['string', '1']]) {
  test(`PASS adapter response with ${name} mutation count is quarantined`, async () => {
    const fixture = createFixture();
    fixture.adapters.artifacts.persistAndVerify = async () => ({ status: 'PASS', mutationCount });
    const result = await runFixture(fixture);
    assert.equal(result.FINAL_STATUS, 'PENDING_LATE_COMPLETION_QUARANTINE');
    assert.equal(result.BLOCKER_CODE, 'BLOCKED_D7_E4E_WRITE_BUDGET_EXCEEDED');
    assert.equal(fixture.transitions.length, 0);
    assert.equal(fixture.lease.finalizes, 0);
  });
}

test('unconfirmed audit response quarantines the completed job without finalizing the lease', async () => {
  const fixture = createFixture();
  fixture.jobStore.appendAuditEvent = async () => ({ resultCode: 'NOT_CONFIRMED' });
  const result = await runFixture(fixture);
  assert.equal(result.FINAL_STATUS, 'PENDING_LATE_COMPLETION_QUARANTINE');
  assert.equal(result.BLOCKER_CODE, 'BLOCKED_D7_E4E_AUDIT_NOT_CONFIRMED');
  assert.equal(fixture.getJob().status, 'COMPLETED');
  assert.equal(fixture.lease.finalizes, 0);
});

test('native marker mutation exception is quarantined before lease acquisition', async () => {
  const fixture = createFixture({
    deps: {
      markerLifecycle: {
        async claim() {
          fixture.calls.push('marker.claim.native-error');
          throw new Error('marker response lost');
        }
      }
    }
  });
  const result = await runFixture(fixture);
  assert.equal(result.FINAL_STATUS, 'PENDING_LATE_COMPLETION_QUARANTINE');
  assert.equal(fixture.lease.reacquires, 0);
  assert.equal(fixture.lease.finalizes, 0);
});

test('unconfirmed marker response is quarantined before lease acquisition', async () => {
  const fixture = createFixture({
    deps: {
      markerLifecycle: {
        async claim() {
          fixture.calls.push('marker.claim.unconfirmed');
          return { status: 'NOT_CONFIRMED', mutationCount: 0 };
        }
      }
    }
  });
  const result = await runFixture(fixture);
  assert.equal(result.FINAL_STATUS, 'PENDING_LATE_COMPLETION_QUARANTINE');
  assert.equal(fixture.lease.reacquires, 0);
});

test('known adapter failure closes the lease as reconciliation-required and stops later stages', async () => {
  const fixture = createFixture();
  fixture.adapters.hoaDon.upsertAndVerify = async () => {
    const error = new Error('BLOCKED_D7_E4E_HOA_DON_VERIFY_FAILED');
    error.code = 'BLOCKED_D7_E4E_HOA_DON_VERIFY_FAILED';
    error.writeOutcome = 'CONFIRMED_NOT_WRITTEN';
    throw error;
  };
  const result = await runFixture(fixture);
  assert.equal(result.FINAL_STATUS, 'BLOCKED_D7_E4E_HOA_DON_VERIFY_FAILED');
  assert.equal(fixture.lease.finalizes, 1);
  assert.equal(fixture.calls.includes('lease.finalize.RECONCILIATION_REQUIRED'), true);
  assert.equal(fixture.calls.includes('adapter.ledger'), false);
});

test('unknown lease close outcome promotes a known failure to quarantine', async () => {
  const fixture = createFixture();
  fixture.adapters.hoaDon.upsertAndVerify = async () => {
    const error = new Error('BLOCKED_D7_E4E_HOA_DON_SCHEMA_INVALID');
    error.code = 'BLOCKED_D7_E4E_HOA_DON_SCHEMA_INVALID';
    error.writeOutcome = 'CONFIRMED_NOT_WRITTEN';
    throw error;
  };
  fixture.leaseStore.finalizeReconciliationLease = async request => {
    fixture.calls.push(`lease.finalize.${request.status}.native-error`);
    fixture.lease.finalizes += 1;
    throw new Error('lease finalize response lost');
  };
  const result = await runFixture(fixture);
  assert.equal(result.FINAL_STATUS, 'PENDING_LATE_COMPLETION_QUARANTINE');
  assert.equal(result.LEASE_CLOSE_STATUS, 'NOT_CONFIRMED');
  assert.equal(fixture.lease.finalizes, 1);
});

for (const [name, response] of [
  ['null', null],
  ['blocked', { status: 'BLOCKED', mutationCount: 0 }],
  ['malformed-count', { status: 'RECONCILIATION_REQUIRED', mutationCount: '1' }]
]) {
  test(`resolved ${name} failure lease close response promotes the result to quarantine`, async () => {
    const fixture = createFixture();
    fixture.adapters.hoaDon.upsertAndVerify = async () => {
      const error = new Error('BLOCKED_D7_E4E_HOA_DON_SCHEMA_INVALID');
      error.code = 'BLOCKED_D7_E4E_HOA_DON_SCHEMA_INVALID';
      error.writeOutcome = 'CONFIRMED_NOT_WRITTEN';
      throw error;
    };
    fixture.leaseStore.finalizeReconciliationLease = async () => {
      fixture.lease.finalizes += 1;
      return response;
    };
    const result = await runFixture(fixture);
    assert.equal(result.FINAL_STATUS, 'PENDING_LATE_COMPLETION_QUARANTINE');
    assert.equal(result.BLOCKER_CODE, 'BLOCKED_D7_E4E_HOA_DON_SCHEMA_INVALID');
    assert.equal(result.LEASE_CLOSE_STATUS, 'NOT_CONFIRMED');
    assert.equal(fixture.lease.finalizes, 1);
  });
}

test('write budget overflow blocks and never reaches completion', async () => {
  const fixture = createFixture();
  fixture.adapters.artifacts.persistAndVerify = async () => ({ status: 'PASS', mutationCount: 3 });
  const result = await runFixture(fixture);
  assert.equal(result.FINAL_STATUS, 'BLOCKED_D7_E4E_WRITE_BUDGET_EXCEEDED');
  assert.equal(fixture.transitions.length, 0);
  assert.equal(fixture.lease.finalizes, 1);
});

test('adapter order enforces Hoa-Don and inventory before Gmail projection and completion', async () => {
  const fixture = createFixture();
  await runFixture(fixture);
  const order = fixture.calls.filter(value => value.startsWith('adapter.'));
  assert.deepEqual(order, ['adapter.artifacts', 'adapter.hoaDon', 'adapter.ledger', 'adapter.inventory', 'adapter.gmail', 'adapter.verifyAll']);
});

test('final verifier executes all five fresh read-only checks on every invocation', async () => {
  const calls = [];
  const checks = ['drive', 'hoaDon', 'ledger', 'inventory', 'gmail'].map(name => async () => { calls.push(name); return true; });
  const verify = gas.call('createD7E4EFreshReadOnlyVerifier_', checks);
  assert.deepEqual(fromVm(await verify({}, {})), { status: 'PASS', freshReadOnlyVerification: true });
  assert.deepEqual(fromVm(await verify({}, {})), { status: 'PASS', freshReadOnlyVerification: true });
  assert.deepEqual(calls, ['drive', 'hoaDon', 'ledger', 'inventory', 'gmail', 'drive', 'hoaDon', 'ledger', 'inventory', 'gmail']);
});

test('final verifier blocks when any fresh read-only check is not confirmed', async () => {
  const checks = [async () => true, async () => true, async () => false, async () => true, async () => true];
  const verify = gas.call('createD7E4EFreshReadOnlyVerifier_', checks);
  await assert.rejects(() => verify({}, {}), /BLOCKED_D7_E4E_FINAL_VERIFICATION_FAILED/);
});

test('fresh inventory verification recomputes and accepts an exact snapshot', () => {
  const invoiceRows = [
    [1, new Date(2026, 8, 20), '', '', 'SKU-1', '', 'NHAP', 10, 5],
    [2, new Date(2026, 8, 21), '', '', 'SKU-1', '', 'XUAT', 4, 0]
  ];
  const itemRows = [['SKU-1', 'Item One', 'EA']];
  const actualRows = [['SKU-1', 'Item One', 'EA', 6, 30, 5]];
  assert.equal(gas.call('assertD7E4EInventorySnapshot_', invoiceRows, itemRows, actualRows, new Date(2026, 8, 21)), true);
});

test('fresh inventory verification accepts valid day-first source dates', () => {
  const invoiceRows = [
    [1, '20/09/2026', '', '', 'SKU-1', '', 'NHAP', 10, 5],
    [2, '21/09/2026', '', '', 'SKU-1', '', 'XUAT', 4, 0]
  ];
  const itemRows = [['SKU-1', 'Item One', 'EA']];
  const actualRows = [['SKU-1', 'Item One', 'EA', 6, 30, 5]];
  assert.equal(gas.call('assertD7E4EInventorySnapshot_', invoiceRows, itemRows, actualRows, '21/09/2026'), true);
});

test('fresh inventory verification applies a supported string cutoff', () => {
  const invoiceRows = [
    [1, '2026-09-20', '', '', 'SKU-1', '', 'NHAP', 10, 5],
    [2, '2026-09-21', '', '', 'SKU-1', '', 'NHAP', 10, 10]
  ];
  const itemRows = [['SKU-1', 'Item One', 'EA']];
  const actualRows = [['SKU-1', 'Item One', 'EA', 10, 50, 5]];
  assert.equal(gas.call('assertD7E4EInventorySnapshot_', invoiceRows, itemRows, actualRows, '2026-09-20'), true);
});

test('fresh inventory verification rejects an invalid cutoff', () => {
  const invoiceRows = [[1, '2026-09-20', '', '', 'SKU-1', '', 'NHAP', 10, 5]];
  const itemRows = [['SKU-1', 'Item One', 'EA']];
  const actualRows = [['SKU-1', 'Item One', 'EA', 10, 50, 5]];
  assert.throws(() => gas.call('assertD7E4EInventorySnapshot_', invoiceRows, itemRows, actualRows, 'not-a-date'), /BLOCKED_D7_E4E_INVENTORY_CUTOFF_INVALID/);
});

test('exact TonKho H6 passes fresh inventory verification', () => {
  const fixture = createInventoryReadbackFixture(new Date(2026, 8, 20));
  assert.equal(gas.call('verifyD7E4EInventoryReadOnly_', fixture.context, fixture.plan), true);
});

test('H6-only drift blocks final inventory verification', () => {
  const fixture = createInventoryReadbackFixture('21/09/2026');
  assert.throws(() => gas.call('verifyD7E4EInventoryReadOnly_', fixture.context, fixture.plan), /BLOCKED_D7_E4E_INVENTORY_CUTOFF_READBACK_DRIFT/);
});

test('fresh inventory verification rejects blank or invalid TonKho H6', () => {
  for (const value of [null, 'not-a-date']) {
    const fixture = createInventoryReadbackFixture(value);
    assert.throws(() => gas.call('verifyD7E4EInventoryReadOnly_', fixture.context, fixture.plan), /BLOCKED_D7_E4E_INVENTORY_CUTOFF_READBACK_INVALID/);
  }
});

test('real inventory writer and final verifier share Date, ISO, and day-first cutoff semantics', () => {
  const fixture = createInventoryWriterFixture();
  assert.deepEqual(fromVm(fixture.rebuild('21/09/2026')), { runId: 'writer-test', status: 'COMPLETED' });
  assert.deepEqual(fixture.inventoryRows, [['SKU-1', 'Item One', 'EA', 15, 70, 70 / 15]]);
  assert.equal(fixture.updateDate.getTime(), new Date(2026, 8, 21).getTime());
  assert.equal(gas.call('assertD7E4EInventorySnapshot_', fixture.invoiceRows, [['SKU-1', 'Item One', 'EA']], fixture.inventoryRows, '21/09/2026'), true);
});

test('real inventory writer rejects an invalid cutoff and retains no-cutoff full rebuild behavior', () => {
  const fullRebuild = createInventoryWriterFixture();
  assert.deepEqual(fromVm(fullRebuild.rebuild()), { runId: 'writer-test', status: 'COMPLETED' });
  assert.deepEqual(fullRebuild.inventoryRows, [['SKU-1', 'Item One', 'EA', 18, 91, 91 / 18]]);
  assert.equal(fullRebuild.updateDate.getTime(), new Date(2026, 8, 22).getTime());

  const invalidCutoff = createInventoryWriterFixture();
  assert.throws(() => invalidCutoff.rebuild('not-a-date'), /Ngay den khong hop le/);
  assert.equal(invalidCutoff.writes, 0);
});

test('invalid cutoff with zero invoice rows is rejected before COMPLETED', () => {
  const fixture = createInventoryWriterFixture({ invoiceRows: [] });
  assert.throws(() => fixture.rebuild('not-a-date'), /Ngay den khong hop le/);
  assert.equal(fixture.writes, 0);
  assert.equal(fixture.progressStatuses.includes('COMPLETED'), false);
});

function createProductionInventoryAdapter() {
  gas.context.createD7EDefaultDriveAdapters_ = () => ({});
  gas.context.createD7EDefaultSheetsAdapters_ = () => ({});
  return gas.call('createD7E4EProductionAdapters_', {
    authorization: { rawProperties: {} },
    precheck: { config: {}, candidate: {} },
    plan: {}
  }).inventory;
}

test('inventory adapter passes a normalized Date cutoff to capNhatTonKho', async () => {
  const calls = [];
  gas.context.capNhatTonKho = async (cutoff, runId) => {
    calls.push({ cutoff, runId });
    return { status: 'COMPLETED' };
  };
  const adapter = createProductionInventoryAdapter();
  assert.deepEqual(fromVm(await adapter.rebuildAndVerify({ jobId: 'job-cutoff', ledgerRows: [{ issueDate: '20/09/2026' }] })), { status: 'PASS', mutationCount: 1 });
  assert.equal(calls.length, 1);
  assert.equal(Object.prototype.toString.call(calls[0].cutoff), '[object Date]');
  assert.equal(calls[0].cutoff.getTime(), new Date(2026, 8, 20).getTime());
  assert.match(calls[0].runId, /^d7e4e-/);
});

test('inventory adapter rejects an invalid cutoff before capNhatTonKho', async () => {
  let calls = 0;
  gas.context.capNhatTonKho = async () => {
    calls += 1;
    return { status: 'COMPLETED' };
  };
  const adapter = createProductionInventoryAdapter();
  await assert.rejects(() => adapter.rebuildAndVerify({ jobId: 'job-invalid-cutoff', ledgerRows: [{ issueDate: 'not-a-date' }] }), error => {
    assert.equal(error.code, 'BLOCKED_D7_E4E_INVENTORY_CUTOFF_INVALID');
    assert.equal(error.writeOutcome, 'CONFIRMED_NOT_WRITTEN');
    return true;
  });
  assert.equal(calls, 0);
});

test('fresh inventory verification blocks a drifted snapshot', () => {
  const invoiceRows = [[1, '2026-09-20', '', '', 'SKU-1', '', 'NHAP', 10, 5]];
  const itemRows = [['SKU-1', 'Item One', 'EA']];
  const actualRows = [['SKU-1', 'Item One', 'EA', 9, 45, 5]];
  assert.throws(() => gas.call('assertD7E4EInventorySnapshot_', invoiceRows, itemRows, actualRows, '2026-09-21'), /BLOCKED_D7_E4E_INVENTORY_FINAL_VERIFY_FAILED/);
});

test('Gmail projection fences a reordered search result to the exact thread identity', async () => {
  const calls = [];
  const expectedId = 'gmail-thread-exact';
  const other = createGmailThread('gmail-thread-other', ['PENDING'], calls);
  const expected = createGmailThread(expectedId, ['PENDING'], calls);
  const expectedHash = threadHash(expectedId);
  gas.context.CONFIG = { SAVE_SHEET_LABEL: 'SAVED', PENDING_LABEL: 'PENDING' };
  gas.context.GmailApp = {
    search: () => [other, expected],
    getUserLabelByName: name => ({ getName: () => name })
  };
  const verification = { gmail: false };
  const adapter = gas.call('createD7E4EGmailProjectionAdapter_', {
    plan: { sourceThreadHash: expectedHash },
    precheck: { config: { query: 'bounded-query', maxResults: 2 }, candidate: { threadIndex: 0, message: { threadIdHash: expectedHash } } }
  }, verification);
  const result = fromVm(await adapter.applyAndVerify());
  assert.deepEqual(result, { status: 'PASS', mutationCount: 1 });
  assert.deepEqual(calls, [`add:${expectedId}:SAVED`, `remove:${expectedId}:PENDING`]);
  assert.equal(verification.gmail, true);
});

test('Gmail projection blocks identity drift before any label mutation', async () => {
  const calls = [];
  const expectedHash = threadHash('gmail-thread-exact');
  gas.context.CONFIG = { SAVE_SHEET_LABEL: 'SAVED', PENDING_LABEL: 'PENDING' };
  gas.context.GmailApp = {
    search: () => [createGmailThread('gmail-thread-other', ['PENDING'], calls)],
    getUserLabelByName: name => ({ getName: () => name })
  };
  const adapter = gas.call('createD7E4EGmailProjectionAdapter_', {
    plan: { sourceThreadHash: expectedHash },
    precheck: { config: { query: 'bounded-query', maxResults: 2 }, candidate: { threadIndex: 0, message: { threadIdHash: expectedHash } } }
  }, { gmail: false });
  await assert.rejects(() => adapter.applyAndVerify(), error => {
    assert.equal(error.code, 'BLOCKED_D7_E4E_GMAIL_THREAD_IDENTITY_NOT_EXACT');
    assert.equal(error.writeOutcome, 'CONFIRMED_NOT_WRITTEN');
    return true;
  });
  assert.deepEqual(calls, []);
});

test('final verification failure prevents COMPLETED and closes the lease safely', async () => {
  const fixture = createFixture();
  fixture.adapters.verifyAll = async () => ({ status: 'BLOCKED' });
  const result = await runFixture(fixture);
  assert.equal(result.FINAL_STATUS, 'BLOCKED_D7_E4E_FINAL_VERIFICATION_FAILED');
  assert.equal(fixture.getJob().status, 'PROJECTIONS_COMMITTED');
  assert.equal(fixture.lease.finalizes, 1);
});

test('result is sanitized and requires no create-job or new-attempt API', async () => {
  const fixture = createFixture();
  const result = await runFixture(fixture);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(fixture.context.plan.jobId), false);
  assert.equal(serialized.includes('fence-sensitive'), false);
  assert.equal(typeof fixture.jobStore.createJobIfAbsent, 'undefined');
  assert.equal(result.COUNTERS.FIRESTORE_JOB_CREATES, 0);
  assert.equal(result.COUNTERS.FIRESTORE_ATTACHMENT_CREATES, 0);
  assert.equal(result.COUNTERS.FIRESTORE_RECONCILIATION_REPORT_CREATES, 0);
});

test('exact lease store reacquires by fence and generation then finalizes completed', async () => {
  let leaseDocument = { jobId: 'job-1', fencingToken: 'fence-1', leaseGeneration: 2, status: 'RECONCILIATION_REQUIRED', leaseOwner: '' };
  const transport = {
    async runTransaction(callback) {
      return callback({
        async getDocument(path) { assert.equal(path, 'worker_leases/job-1'); return { ...leaseDocument }; },
        async updateDocument(path, value) { assert.equal(path, 'worker_leases/job-1'); leaseDocument = { ...value }; }
      });
    }
  };
  const store = gas.call('createD7E4EExactLeaseStore_', transport, { clock: { now: () => '2026-09-22T00:00:00.000Z' } });
  const acquired = fromVm(await store.reacquireReconciliationLease({ jobId: 'job-1', expectedFence: 'fence-1', expectedGeneration: 2, leaseOwner: 'apps_script_d7_e4e' }));
  assert.equal(acquired.status, 'ACTIVE');
  assert.equal(acquired.lease.leaseGeneration, 3);
  const completed = fromVm(await store.finalizeReconciliationLease({ jobId: 'job-1', expectedFence: 'fence-1', expectedGeneration: 3, leaseOwner: 'apps_script_d7_e4e', status: 'COMPLETED' }));
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(completed.lease.finalJobStatus, 'COMPLETED');
  assert.equal(completed.lease.reconciliationErrorCode, '');
});
