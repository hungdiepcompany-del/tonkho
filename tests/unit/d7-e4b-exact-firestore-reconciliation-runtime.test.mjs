import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'durableJobState.js',
    'firestoreDurableJobStore.js',
    'D7_E_OwnerApprovedOneCandidateProductionPilot.js',
    'D7_E4B_ExactFirestoreReconciliationRuntime.js',
    'Operator_Entrypoints.js'
  ],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: [
    'durableJobState.js',
    'firestoreDurableJobStore.js',
    'D7_E_OwnerApprovedOneCandidateProductionPilot.js',
    'D7_E4B_ExactFirestoreReconciliationRuntime.js'
  ],
  exportNames: [
    'D7_E4B_PHASE_',
    'D7_E4B_SCHEMA_VERSION_',
    'D7_E4B_PUBLIC_ENTRYPOINT_',
    'D7_E4B_OWNER_MARKER_PROPERTY_',
    'D7_E4B_OWNER_MARKER_VALUE_',
    'D7_E4B_WRITE_BUDGET_',
    'D7_E4B_AUDIT_EVENT_TYPE_',
    'createD7E4BExactFirestoreReconciliationRunner_',
    'createD7E4BExactLeaseStore_',
    'buildD7E4BExpectedIdentity_',
    'buildD7E4BReconciliationPlan_',
    'assertDurableJobTransition_',
    'durableIdentityHashPrefixD7E_'
  ]
});

const source = fs.readFileSync('D7_E4B_ExactFirestoreReconciliationRuntime.js', 'utf8');
const entrypoints = fs.readFileSync('Operator_Entrypoints.js', 'utf8');
const candidateFingerprint = 'a'.repeat(64);
const xmlSha256 = 'b'.repeat(64);
const pdfSha256 = 'c'.repeat(64);
const attachmentSetHash = 'd'.repeat(64);
const jobId = 'd7e_job_' + candidateFingerprint.slice(0, 24);
const invoiceIdentityHash = gas.call('durableIdentityHashPrefixD7E_', candidateFingerprint);
const leaseFence = 'd7e_lease_' + jobId;

function fromVm(value) {
  return JSON.parse(JSON.stringify(value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validProperties(overrides = {}) {
  return {
    D7_E4B_OWNER_APPROVAL_MARKER: gas.exports.D7_E4B_OWNER_MARKER_VALUE_,
    D7_E_CANONICAL_CANDIDATE_FINGERPRINT: candidateFingerprint,
    D7_E_CANONICAL_XML_SHA256: xmlSha256,
    D7_E_CANONICAL_PDF_SHA256: pdfSha256,
    D7_E_CANONICAL_INVOICE_IDENTITY_HASH: candidateFingerprint,
    D7_E_CANONICAL_ATTACHMENT_SET_HASH: attachmentSetHash,
    ...overrides
  };
}

function initialSnapshot() {
  const existingReport = {
    reportId: 'existing_reconciliation_report',
    jobId,
    status: 'RECONCILIATION_REQUIRED'
  };
  return {
    exactJobCount: 1,
    nonExactCandidateCount: 0,
    readOutcomeUnknown: false,
    job: {
      jobId,
      invoiceIdentityHash,
      sourceThreadHash: '1a2b3c4d',
      status: 'VALIDATED',
      version: 4,
      reconciliationStatus: 'RECONCILIATION_REQUIRED',
      latestReconciliationReportId: existingReport.reportId,
      commitPlan: {
        version: 'DURABLE_COMMIT_PLAN_V1',
        jobId,
        legacyInvoiceKey: 'safe_invoice_key',
        invoiceKeyV2: 'safe_invoice_key',
        expectedLineCount: 1,
        legacyHashIndexes: ['safe_hash_index'],
        lineIdentityV2s: ['safe_line_identity'],
        lines: [{
          legacyHashIndex: 'safe_hash_index',
          lineIdentityV2: 'safe_line_identity',
          immutableFields: { direction: 'NHAP', itemCode: 'SAFE_ITEM', quantity: 2, unitPrice: 5 }
        }],
        driveEvidenceTargets: { xmlContentHash: xmlSha256, pdfContentHash: pdfSha256 }
      }
    },
    lease: {
      leaseId: jobId,
      jobId,
      status: 'RECONCILIATION_REQUIRED',
      fencingToken: leaseFence,
      leaseGeneration: 2,
      leaseOwner: 'apps_script_d7_e'
    },
    events: [
      { eventId: 'evt_000001', sequence: 1, eventType: 'D7E_APPROVED_CANDIDATE_ACCEPTED' },
      { eventId: 'evt_000002', sequence: 2, eventType: 'D7E_COMMIT_PLAN_ACCEPTED' }
    ],
    eventsComplete: true,
    reports: [existingReport],
    reportsComplete: true,
    latestReportValid: true,
    xmlAttachmentPresent: false,
    pdfAttachmentPresent: false,
    sheetExactRowPresent: true,
    sheetContentMatches: true,
    driveXmlMatches: true,
    drivePdfMatches: true
  };
}

function makeFailure(kind, code = 'SYNTHETIC_WRITE_FAILURE') {
  const error = new Error(code);
  error.code = code;
  if (kind === 'unknown') error.writeOutcome = 'UNKNOWN';
  if (kind === 'known') error.knownFailure = true;
  return error;
}

async function runScenario(options = {}) {
  const state = options.snapshot ? clone(options.snapshot) : initialSnapshot();
  if (options.mutateSnapshot) options.mutateSnapshot(state);
  const operationLog = [];
  const logs = [];
  let captureCount = 0;

  function fail(stage) {
    const spec = options.failures && options.failures[stage];
    if (spec) throw makeFailure(spec.kind || spec, spec.code);
  }

  const leaseStore = {
    async reacquireReconciliationLease(request) {
      operationLog.push('lease-reacquire');
      fail('lease-reacquire');
      assert.equal(request.expectedGeneration, state.lease.leaseGeneration);
      state.lease = { ...state.lease, status: 'ACTIVE', leaseOwner: request.leaseOwner, leaseGeneration: request.expectedGeneration + 1 };
      return { status: 'ACQUIRED_AFTER_RECONCILIATION_REQUIRED', mutationCount: 1, lease: clone(state.lease) };
    },
    async finalizeReconciliationLease(request) {
      operationLog.push('lease-finalize');
      fail('lease-finalize');
      assert.equal(request.expectedGeneration, state.lease.leaseGeneration);
      state.lease = { ...state.lease, status: 'RECONCILIATION_REQUIRED', finalJobStatus: 'RECONCILIATION_REQUIRED' };
      return { status: 'RECONCILIATION_REQUIRED', mutationCount: 1, lease: clone(state.lease) };
    }
  };

  const jobStore = {
    async saveReconciliationReport(request) {
      operationLog.push('report-transaction');
      fail('report');
      assert.equal(request.expectedVersion, 4);
      state.reports.push(clone(request.report));
      state.job = { ...state.job, version: 5, reconciliationStatus: 'RECONCILIATION_REQUIRED', latestReconciliationReportId: request.report.reportId };
      return { resultCode: 'RECONCILIATION_REPORT_SAVED', report: clone(request.report), job: clone(state.job) };
    },
    async transitionJob(request) {
      const stage = request.toStatus === 'FAILED_REVIEW_REQUIRED' ? 'transition-1' : 'transition-2';
      operationLog.push(stage);
      fail(stage);
      if (Number(state.job.version) !== Number(request.expectedVersion) || state.job.status !== request.fromStatus) {
        const error = makeFailure('known', 'DURABLE_JOB_VERSION_CONFLICT');
        throw error;
      }
      state.job = { ...state.job, version: state.job.version + 1, status: request.toStatus };
      return { resultCode: 'JOB_TRANSITIONED', job: clone(state.job) };
    },
    async appendAuditEvent(request) {
      operationLog.push('audit');
      fail('audit');
      const event = { eventId: 'evt_000003', sequence: request.sequence, eventType: request.eventType };
      state.events.push(event);
      return { resultCode: 'AUDIT_EVENT_APPENDED', event: clone(event) };
    }
  };

  const runner = gas.call('createD7E4BExactFirestoreReconciliationRunner_', {
    readProperties: () => options.properties || validProperties(),
    captureSnapshot: async () => {
      captureCount += 1;
      const captured = clone(state);
      if (captureCount > 1 && options.postWriteMismatch) options.postWriteMismatch(captured);
      return captured;
    },
    createJobStore: () => jobStore,
    createLeaseStore: () => leaseStore,
    createLock: () => ({ tryLock: () => true, releaseLock() {} }),
    clock: { now: () => '2026-08-11T00:00:00.000Z' },
    logger: { log: value => logs.push(String(value)) }
  });
  const result = fromVm(await runner.run());
  return { result, state, operationLog, logs, captureCount };
}

function assertZeroWrites(result) {
  assert.equal(result.FIRESTORE_TOTAL_WRITE_COUNT, 0);
  assert.equal(result.REPORT_CREATE_COUNT, 0);
  assert.equal(result.AUDIT_CREATE_COUNT, 0);
  assert.equal(result.ATTACHMENT_CREATE_COUNT, 0);
  assert.equal(result.JOB_UPDATE_COUNT, 0);
  assert.equal(result.LEASE_UPDATE_COUNT, 0);
}

test('D7-E4B declares a dedicated owner marker, runtime schema, and public entrypoint', () => {
  assert.equal(TEST_METADATA.ownerPolicyRequired, true);
  assert.equal(gas.exports.D7_E4B_PHASE_, 'D7_E4B1_EXACT_RECONCILIATION_RUNTIME_IMPLEMENTATION_AND_SOURCE_SYNC');
  assert.equal(gas.exports.D7_E4B_PUBLIC_ENTRYPOINT_, 'runD7E4BExactFirestoreReconciliation');
  assert.equal(gas.exports.D7_E4B_OWNER_MARKER_PROPERTY_, 'D7_E4B_OWNER_APPROVAL_MARKER');
  assert.match(gas.exports.D7_E4B_OWNER_MARKER_VALUE_, /SEVEN_FIRESTORE_WRITES_NO_EXTERNAL_MUTATION/);
  assert.match(entrypoints, /function runD7E4BExactFirestoreReconciliation\(\)/);
});

test('1 invalid owner marker produces zero writes', async () => {
  const { result, captureCount } = await runScenario({ properties: validProperties({ D7_E4B_OWNER_APPROVAL_MARKER: 'WRONG' }) });
  assert.equal(result.FINAL_STATUS, 'BLOCKED_D7_E4B_OWNER_MARKER_INVALID');
  assert.equal(captureCount, 0);
  assertZeroWrites(result);
});

test('2 missing canonical property produces zero writes', async () => {
  const { result } = await runScenario({ properties: validProperties({ D7_E_CANONICAL_XML_SHA256: '' }) });
  assert.equal(result.FINAL_STATUS, 'BLOCKED_D7_E4B_PRECONDITION_CHANGED');
  assertZeroWrites(result);
});

test('3 canonical candidate and invoice mismatch produces zero writes', async () => {
  const { result } = await runScenario({ properties: validProperties({ D7_E_CANONICAL_INVOICE_IDENTITY_HASH: 'e'.repeat(64) }) });
  assert.equal(result.FINAL_STATUS, 'BLOCKED_D7_E4B_PRECONDITION_CHANGED');
  assertZeroWrites(result);
});

const preconditionCases = [
  ['4 cardinality zero', s => { s.exactJobCount = 0; }],
  ['5 cardinality two-plus', s => { s.exactJobCount = 2; }],
  ['6 non-exact candidate', s => { s.nonExactCandidateCount = 1; }],
  ['7 job state mismatch', s => { s.job.status = 'FAILED_RETRYABLE'; }],
  ['8 initial version is not 4', s => { s.job.version = 3; }],
  ['9 commit-plan mismatch', s => { s.job.commitPlan.driveEvidenceTargets.xmlContentHash = 'e'.repeat(64); }],
  ['10 lease state mismatch', s => { s.lease.status = 'ACTIVE'; }],
  ['11 lease fence mismatch', s => { s.lease.fencingToken = 'foreign_fence'; }],
  ['12 active foreign lease', s => { s.lease.status = 'ACTIVE'; s.lease.leaseOwner = 'foreign_owner'; }],
  ['13 audit count is not 2', s => { s.events.pop(); }],
  ['14 report count is not 1', s => { s.reports.push({ reportId: 'extra', jobId, status: 'RECONCILIATION_REQUIRED' }); }],
  ['15 attachment unexpectedly present', s => { s.xmlAttachmentPresent = true; }],
  ['16 Sheet mismatch', s => { s.sheetContentMatches = false; }],
  ['17 Drive XML mismatch', s => { s.driveXmlMatches = false; }],
  ['18 Drive PDF mismatch', s => { s.drivePdfMatches = false; }]
];

for (const [name, mutateSnapshot] of preconditionCases) {
  test(`${name} fails closed before all writes`, async () => {
    const { result, operationLog } = await runScenario({ mutateSnapshot });
    assert.equal(result.FINAL_STATUS, 'BLOCKED_D7_E4B_PRECONDITION_CHANGED');
    assert.equal(operationLog.length, 0);
    assertZeroWrites(result);
  });
}

test('D7-E4A1 owner marker must remain absent', async () => {
  const { result } = await runScenario({ properties: validProperties({ D7_E4A1_OWNER_APPROVAL_MARKER: 'STALE_MARKER' }) });
  assert.equal(result.FINAL_STATUS, 'BLOCKED_D7_E4B_PRECONDITION_CHANGED');
  assertZeroWrites(result);
});

test('incomplete audit or report listing fails closed', async () => {
  const first = await runScenario({ mutateSnapshot: s => { s.eventsComplete = false; } });
  const second = await runScenario({ mutateSnapshot: s => { s.reportsComplete = false; } });
  assertZeroWrites(first.result);
  assertZeroWrites(second.result);
});

test('19 exact happy path performs exactly seven Firestore writes', async () => {
  const { result } = await runScenario();
  assert.equal(result.FINAL_STATUS, 'PASS_D7_E4B1_EXACT_RECONCILIATION_RUNTIME_READY_NOT_EXECUTED');
  assert.equal(result.FIRESTORE_TOTAL_WRITE_COUNT, 7);
});

test('20 happy path performs exactly three job updates', async () => {
  const { result } = await runScenario();
  assert.equal(result.JOB_UPDATE_COUNT, 3);
});

test('21 happy path performs exactly two lease updates', async () => {
  const { result } = await runScenario();
  assert.equal(result.LEASE_UPDATE_COUNT, 2);
});

test('22 happy path creates exactly one reconciliation report', async () => {
  const { result } = await runScenario();
  assert.equal(result.REPORT_CREATE_COUNT, 1);
});

test('23 happy path creates exactly one audit event', async () => {
  const { result } = await runScenario();
  assert.equal(result.AUDIT_CREATE_COUNT, 1);
});

test('24 happy path creates zero attachment records', async () => {
  const { result } = await runScenario();
  assert.equal(result.ATTACHMENT_CREATE_COUNT, 0);
});

test('25 state path is exactly VALIDATED to FAILED_REVIEW_REQUIRED to RECONCILIATION_REQUIRED', async () => {
  const { operationLog, state } = await runScenario();
  assert.deepEqual(operationLog, ['lease-reacquire', 'report-transaction', 'transition-1', 'transition-2', 'audit', 'lease-finalize']);
  assert.equal(state.job.status, 'RECONCILIATION_REQUIRED');
  assert.equal(state.job.version, 7);
});

test('26 direct VALIDATED to RECONCILIATION_REQUIRED is prohibited by the state machine and unused by runtime', () => {
  assert.throws(() => gas.call('assertDurableJobTransition_', 'VALIDATED', 'RECONCILIATION_REQUIRED'), /DURABLE_JOB_INVALID_TRANSITION/);
  assert.doesNotMatch(source, /fromStatus:\s*'VALIDATED',[\s\S]{0,80}toStatus:\s*'RECONCILIATION_REQUIRED'/);
});

test('27 optimistic-version mismatch mid-flow stops and safely finalizes the proven lease once', async () => {
  const { result, operationLog } = await runScenario({ failures: { 'transition-1': { kind: 'known', code: 'DURABLE_JOB_VERSION_CONFLICT' } } });
  assert.equal(result.JOB_UPDATE_COUNT, 1);
  assert.equal(result.LEASE_UPDATE_COUNT, 2);
  assert.equal(operationLog.filter(item => item === 'lease-finalize').length, 1);
});

test('28 known failure after lease acquisition has a bounded two-write failure path', async () => {
  const { result, operationLog } = await runScenario({ failures: { report: { kind: 'known', code: 'KNOWN_REPORT_REJECTED_BEFORE_WRITE' } } });
  assert.equal(result.FIRESTORE_TOTAL_WRITE_COUNT, 2);
  assert.deepEqual(operationLog, ['lease-reacquire', 'report-transaction', 'lease-finalize']);
});

const unknownCases = [
  ['29 unknown report-write outcome', 'report', 1],
  ['30 unknown job-write outcome', 'transition-1', 3],
  ['31 unknown audit-write outcome', 'audit', 5],
  ['32 unknown lease-finalization outcome', 'lease-finalize', 6]
];

for (const [name, stage, expectedConfirmedWrites] of unknownCases) {
  test(`${name} stops without speculative retry or cleanup write`, async () => {
    const { result, operationLog } = await runScenario({ failures: { [stage]: { kind: 'unknown', code: 'FIRESTORE_WRITE_UNCONFIRMED' } } });
    assert.equal(result.FINAL_STATUS, 'UNKNOWN_WRITE_OUTCOME_REQUIRES_OWNER_REVIEW');
    assert.equal(result.UNKNOWN_WRITE_OUTCOME, 'YES');
    assert.equal(result.FIRESTORE_TOTAL_WRITE_COUNT, expectedConfirmedWrites);
    if (stage !== 'lease-finalize') assert.equal(operationLog.includes('lease-finalize'), false);
  });
}

test('unknown second job transition also stops all later writes', async () => {
  const { result, operationLog } = await runScenario({ failures: { 'transition-2': { kind: 'unknown', code: 'FIRESTORE_TRANSPORT_ERROR' } } });
  assert.equal(result.UNKNOWN_WRITE_OUTCOME, 'YES');
  assert.equal(operationLog.includes('audit'), false);
  assert.equal(operationLog.includes('lease-finalize'), false);
});

test('33 deterministic report identity is stable for the same exact job and disposition', () => {
  const authorization = { canonical: { candidateFingerprint, invoiceIdentityHash: candidateFingerprint, xmlSha256, pdfSha256 } };
  const expected = fromVm(gas.call('buildD7E4BExpectedIdentity_', authorization));
  const first = fromVm(gas.call('buildD7E4BReconciliationPlan_', expected, initialSnapshot(), '2026-08-11T00:00:00.000Z'));
  const second = fromVm(gas.call('buildD7E4BReconciliationPlan_', expected, initialSnapshot(), '2026-08-12T00:00:00.000Z'));
  assert.equal(first.reportId, second.reportId);
});

test('34 deterministic audit replay uses the fixed next-sequence event identity', async () => {
  const { state } = await runScenario();
  assert.equal(state.events[2].eventId, 'evt_000003');
  assert.equal(state.events[2].eventType, gas.exports.D7_E4B_AUDIT_EVENT_TYPE_);
});

test('35 accidental rerun after confirmed success is a zero-write no-op', async () => {
  const first = await runScenario();
  const second = await runScenario({ snapshot: first.state });
  assert.equal(second.result.FINAL_STATUS, 'PASS_D7_E4B_ALREADY_RECONCILED_NOOP');
  assert.equal(second.operationLog.length, 0);
  assertZeroWrites(second.result);
});

test('36 post-write verification mismatch is reported after the bounded success writes', async () => {
  const { result } = await runScenario({ postWriteMismatch: snapshot => { snapshot.drivePdfMatches = false; } });
  assert.equal(result.FINAL_STATUS, 'BLOCKED_D7_E4B_POST_WRITE_VERIFICATION_MISMATCH');
  assert.equal(result.FIRESTORE_TOTAL_WRITE_COUNT, 7);
});

test('37 every non-Firestore mutation counter remains zero', async () => {
  const { result } = await runScenario();
  for (const key of ['GMAIL_MUTATION_COUNT', 'DRIVE_MUTATION_COUNT', 'SHEETS_MUTATION_COUNT', 'SCRIPT_PROPERTY_MUTATION_COUNT', 'TRIGGER_MUTATION_COUNT', 'DESTRUCTIVE_OPERATION_COUNT']) {
    assert.equal(result[key], 0, key);
  }
});

test('38 sanitized logging emits no canonical hashes, job identifiers, invoice data, or secrets', async () => {
  const { result, logs } = await runScenario();
  assert.equal(result.RAW_SENSITIVE_VALUE_LOGGED_COUNT, 0);
  assert.equal(logs.length, 1);
  for (const forbidden of [candidateFingerprint, xmlSha256, pdfSha256, jobId, 'safe_invoice_key']) assert.equal(logs[0].includes(forbidden), false);
});

test('39 exact success write budget cannot exceed seven and every category maximum is immutable', async () => {
  const budget = fromVm(gas.exports.D7_E4B_WRITE_BUDGET_);
  assert.deepEqual(budget, {
    JOB_UPDATES: 3, LEASE_UPDATES: 2, RECONCILIATION_REPORT_CREATES: 1, AUDIT_EVENT_CREATES: 1,
    ATTACHMENT_CREATES: 0, FIRESTORE_TOTAL: 7, GMAIL: 0, DRIVE: 0, SHEETS: 0, SCRIPT_PROPERTIES: 0, TRIGGERS: 0, DESTRUCTIVE: 0
  });
  const { result } = await runScenario();
  assert.equal(result.FIRESTORE_TOTAL_WRITE_COUNT <= budget.FIRESTORE_TOTAL, true);
});

test('lease store enforces exact fence and generation before either lease write', async () => {
  let lease = { leaseId: jobId, jobId, status: 'RECONCILIATION_REQUIRED', fencingToken: leaseFence, leaseGeneration: 3, leaseOwner: 'apps_script_d7_e' };
  let updates = 0;
  const transport = {
    async runTransaction(work) {
      return work({
        async getDocument() { return clone(lease); },
        async updateDocument(_path, next) { updates += 1; lease = clone(next); }
      });
    }
  };
  const store = gas.call('createD7E4BExactLeaseStore_', transport, { clock: { now: () => '2026-08-11T00:00:00.000Z' } });
  await assert.rejects(store.reacquireReconciliationLease({ leaseId: jobId, jobId, fencingToken: 'wrong', expectedGeneration: 3 }), /LEASE_FENCE_OR_GENERATION_MISMATCH/);
  await assert.rejects(store.reacquireReconciliationLease({ leaseId: jobId, jobId, fencingToken: leaseFence, expectedGeneration: 2 }), /LEASE_FENCE_OR_GENERATION_MISMATCH/);
  assert.equal(updates, 0);
});

test('runtime source never calls the D7-E pilot, candidate rediscovery, or external mutation APIs', () => {
  assert.doesNotMatch(source, /runD7EOwnerApprovedOneCandidateProductionPilot\s*\(/);
  assert.doesNotMatch(source, /rediscoverD7ECandidateReadOnly_|GmailApp\./);
  assert.doesNotMatch(source, /createFile|setValues|appendImmutableTransactionsIfAbsent|setProperty|deleteProperty/);
});
