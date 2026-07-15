import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import {
  createD2Clock,
  createD2CommitPlan,
  createD2JobSeed,
  createD2Report,
  createFakeFirestoreTransport,
  D2_FAULT_INJECTION_CASES
} from '../../fixtures/sgds-crit-003-d2/firestore-adapter-fixtures.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['durableJobState.js', 'firestoreDurableJobStore.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const REQUIRED_ERROR_CODES = Object.freeze([
  'DURABLE_JOB_NOT_FOUND',
  'DURABLE_JOB_ALREADY_EXISTS',
  'DURABLE_JOB_VERSION_CONFLICT',
  'DURABLE_JOB_ILLEGAL_TRANSITION',
  'DURABLE_JOB_TERMINAL_STATE',
  'COMMIT_PLAN_MISSING',
  'COMMIT_PLAN_HASH_MISMATCH',
  'COMMIT_PLAN_IMMUTABILITY_VIOLATION',
  'AUDIT_EVENT_SEQUENCE_CONFLICT',
  'RECONCILIATION_REPORT_INVALID',
  'FIRESTORE_TRANSPORT_ERROR',
  'FIRESTORE_WRITE_UNCONFIRMED'
]);

const fromVm = (value) => JSON.parse(JSON.stringify(value));
const clone = (value) => JSON.parse(JSON.stringify(value));

const gas = loadGasSource({
  files: ['durableJobState.js', 'firestoreDurableJobStore.js'],
  exportNames: [
    'createDurableInvoiceJobStore',
    'FIRESTORE_DURABLE_ERROR_CODES_',
    'buildDurableCommitPlan_'
  ]
});

function makeStore(options = {}) {
  const transport = options.transport || createFakeFirestoreTransport(options.transportOptions || {});
  const store = gas.call('createDurableInvoiceJobStore', transport, { clock: options.clock || createD2Clock() });
  return { store, transport };
}

async function createJob(store, seed = createD2JobSeed()) {
  return fromVm(await store.createJobIfAbsent(seed));
}

async function assertRejectCode(promise, code) {
  await assert.rejects(promise, (error) => error && error.code === code);
}

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

test('D2 exposes required sanitized adapter error codes and fault fixtures', () => {
  assert.deepEqual(fromVm(gas.exports.FIRESTORE_DURABLE_ERROR_CODES_), REQUIRED_ERROR_CODES);
  assert.equal(D2_FAULT_INJECTION_CASES.length, 8);
});

test('D2 create new job, create same job twice, same identity, and different identity', async () => {
  const { store } = makeStore();
  const first = await createJob(store);
  const second = await createJob(store);
  const sameIdentity = await createJob(store, createD2JobSeed({ jobId: first.job.jobId }));
  const different = await createJob(store, createD2JobSeed({ invoiceIdentityHash: 'synthetic-other-invoice-identity' }));

  assert.equal(first.resultCode, 'JOB_CREATED');
  assert.equal(second.resultCode, 'JOB_ALREADY_EXISTS_IDEMPOTENT');
  assert.equal(sameIdentity.job.jobId, first.job.jobId);
  assert.notEqual(different.job.jobId, first.job.jobId);
  assert.equal(second.job.attemptCount, 0);
  assert.equal(second.job.commitPlan, null);
});

test('D2 transition requires expected version, blocks stale version, illegal jump, and terminal mutation', async () => {
  const { store } = makeStore();
  const created = await createJob(store);
  const transitioned = fromVm(await store.transitionJob({
    jobId: created.job.jobId,
    expectedVersion: 1,
    fromStatus: 'DETECTED',
    toStatus: 'COLLECTED',
    idempotencyKey: 'synthetic-transition-1'
  }));

  assert.equal(transitioned.resultCode, 'JOB_TRANSITIONED');
  assert.equal(transitioned.job.version, 2);
  assert.equal(transitioned.job.status, 'COLLECTED');
  await assertRejectCode(store.transitionJob({ jobId: created.job.jobId, expectedVersion: 1, fromStatus: 'COLLECTED', toStatus: 'PARSED' }), 'DURABLE_JOB_VERSION_CONFLICT');
  await assertRejectCode(store.transitionJob({ jobId: created.job.jobId, expectedVersion: 2, fromStatus: 'COLLECTED', toStatus: 'ROWS_COMMITTED' }), 'DURABLE_JOB_ILLEGAL_TRANSITION');

  const terminal = await createJob(store, createD2JobSeed({ jobId: 'synthetic-terminal-job', status: 'COMPLETED' }));
  await assertRejectCode(store.transitionJob({ jobId: terminal.job.jobId, expectedVersion: 1, fromStatus: 'COMPLETED', toStatus: 'COLLECTED' }), 'DURABLE_JOB_TERMINAL_STATE');
});

test('D2 completed resume remains idempotent and does not move terminal state', async () => {
  const { store } = makeStore();
  const terminal = await createJob(store, createD2JobSeed({ jobId: 'synthetic-completed-job', status: 'COMPLETED' }));
  const result = fromVm(await store.resumeCompletedJob({
    jobId: terminal.job.jobId,
    verification: { ledgerVerified: true, registryVerified: true, projectionVerified: true }
  }));
  const after = fromVm(await store.getJob(terminal.job.jobId));

  assert.equal(result.action, 'IDEMPOTENT_COMPLETE_NOOP');
  assert.equal(result.safeToMutate, false);
  assert.equal(after.status, 'COMPLETED');
  assert.equal(after.version, 1);
});

test('D2 commit plan saves once, repeats idempotently, blocks changes, and resists caller mutation', async () => {
  const { store } = makeStore();
  const created = await createJob(store, createD2JobSeed({ jobId: 'synthetic-plan-job' }));
  const plan = createD2CommitPlan({ jobId: created.job.jobId });
  const planBefore = clone(plan);
  const first = fromVm(await store.saveCommitPlanIfAbsent({ jobId: created.job.jobId, expectedVersion: 1, commitPlan: plan }));
  plan.lines[0].legacyHashIndex = 'synthetic-mutated-after-save';
  const afterMutation = fromVm(await store.getJob(created.job.jobId));
  const second = fromVm(await store.saveCommitPlanIfAbsent({ jobId: created.job.jobId, expectedVersion: 999, commitPlan: planBefore }));
  const changed = createD2CommitPlan({ jobId: created.job.jobId, lines: [{ sourceLineNo: 1, legacyHashIndex: 'synthetic-other-line-hash', lineIdentityV2: 'synthetic-line-id-1' }], expectedLineCount: 1, legacyHashIndexes: ['synthetic-other-line-hash'], lineIdentityV2s: ['synthetic-line-id-1'] });

  assert.equal(first.resultCode, 'PLAN_SAVED');
  assert.equal(first.job.version, 2);
  assert.equal(second.resultCode, 'IDEMPOTENT_PLAN_MATCH');
  assert.deepEqual(afterMutation.commitPlan, planBefore);
  await assertRejectCode(store.saveCommitPlanIfAbsent({ jobId: created.job.jobId, expectedVersion: 2, commitPlan: changed }), 'COMMIT_PLAN_IMMUTABILITY_VIOLATION');
});

test('D2 audit events append in order, cannot be overwritten, and sanitize safeDetails', async () => {
  const { store } = makeStore();
  const created = await createJob(store, createD2JobSeed({ jobId: 'synthetic-audit-job' }));
  const first = fromVm(await store.appendAuditEvent({
    jobId: created.job.jobId,
    eventType: 'JOB_CREATED',
    actorType: 'SYSTEM',
    safeDetails: { contact: 'synthetic@example.invalid', numericId: '1234567890', note: 'safe synthetic note' }
  }));
  const second = fromVm(await store.appendAuditEvent({ jobId: created.job.jobId, eventType: 'JOB_SEEN', actorType: 'SYSTEM' }));

  assert.equal(first.event.sequence, 1);
  assert.equal(second.event.sequence, 2);
  assert.equal(first.event.safeDetails.contact, 'REDACTED_EMAIL');
  assert.equal(first.event.safeDetails.numericId, 'REDACTED_NUMERIC_IDENTIFIER');
  assert.equal(JSON.stringify(first.event).includes('@'), false);
  await assertRejectCode(store.appendAuditEvent({ jobId: created.job.jobId, sequence: 1, eventType: 'OVERWRITE_ATTEMPT' }), 'AUDIT_EVENT_SEQUENCE_CONFLICT');
});

test('D2 reconciliation report persistence stores consistent and blocker reports without repair', async () => {
  const { store } = makeStore();
  const consistentJob = await createJob(store, createD2JobSeed({ jobId: 'synthetic-report-job-1' }));
  const consistent = fromVm(await store.saveReconciliationReport({
    jobId: consistentJob.job.jobId,
    expectedVersion: 1,
    report: createD2Report({ jobId: consistentJob.job.jobId, reportId: 'rpt_synthetic_consistent' })
  }));
  const latest = fromVm(await store.getLatestReconciliationReport(consistentJob.job.jobId));

  const blockerJob = await createJob(store, createD2JobSeed({ jobId: 'synthetic-report-job-2' }));
  const blocker = fromVm(await store.saveReconciliationReport({
    jobId: blockerJob.job.jobId,
    expectedVersion: 1,
    report: createD2Report({
      jobId: blockerJob.job.jobId,
      reportId: 'rpt_synthetic_blocker',
      status: 'CONFLICTED',
      findingCount: 1,
      blockerCount: 1,
      findings: [{ code: 'LEDGER_ROWS_MISSING', severity: 'ERROR', scope: 'LEDGER', repairPolicy: 'REPORT_ONLY', safeMessage: 'REPORT_ONLY_LEDGER_LEDGER_ROWS_MISSING' }]
    })
  }));

  assert.equal(consistent.job.reconciliationStatus, 'CONSISTENT');
  assert.equal(latest.reportId, 'rpt_synthetic_consistent');
  assert.equal(blocker.job.reconciliationStatus, 'RECONCILIATION_REQUIRED');
  assert.equal(blocker.job.status, 'DETECTED');
  assert.equal(JSON.stringify(blocker.report).includes('raw'), false);
});

test('D2 markReconciliationRequired uses expected version and only updates reconciliation metadata', async () => {
  const { store } = makeStore();
  const created = await createJob(store, createD2JobSeed({ jobId: 'synthetic-reconcile-mark-job' }));
  await assertRejectCode(store.markReconciliationRequired({ jobId: created.job.jobId, expectedVersion: 2, errorCode: 'SYNTHETIC_ERROR' }), 'DURABLE_JOB_VERSION_CONFLICT');
  const marked = fromVm(await store.markReconciliationRequired({ jobId: created.job.jobId, expectedVersion: 1, errorCode: 'SYNTHETIC_ERROR', errorStage: 'LOCAL_TEST' }));

  assert.equal(marked.job.reconciliationStatus, 'RECONCILIATION_REQUIRED');
  assert.equal(marked.job.status, 'DETECTED');
  assert.equal(marked.job.version, 2);
});

test('D2 transport failure before write is confirmed not written', async () => {
  const { store, transport } = makeStore({ transportOptions: { failures: [{ op: 'createDocument', timing: 'before' }] } });
  await assertRejectCode(store.createJobIfAbsent(createD2JobSeed({ jobId: 'synthetic-before-create-failure' })), 'FIRESTORE_TRANSPORT_ERROR');
  assert.equal(transport.dump().length, 0);
});

test('D2 transport failure after create response lost is unknown and retry is idempotent', async () => {
  const seed = createD2JobSeed({ jobId: 'synthetic-after-create-failure' });
  const { store, transport } = makeStore({ transportOptions: { failures: [{ op: 'createDocument', timing: 'after' }] } });
  await assertRejectCode(store.createJobIfAbsent(seed), 'FIRESTORE_WRITE_UNCONFIRMED');
  assert.equal(transport.dump().some(([path]) => path === 'invoiceJobs/synthetic-after-create-failure'), true);
  const retry = fromVm(await store.createJobIfAbsent(seed));
  assert.equal(retry.resultCode, 'JOB_ALREADY_EXISTS_IDEMPOTENT');
});

test('D2 transition failure before and after commit preserve confirmed outcome semantics', async () => {
  const before = makeStore({ transportOptions: { failures: [{ op: 'updateDocument', timing: 'before' }] } });
  const beforeJob = await createJob(before.store, createD2JobSeed({ jobId: 'synthetic-before-transition-failure' }));
  await assertRejectCode(before.store.transitionJob({ jobId: beforeJob.job.jobId, expectedVersion: 1, fromStatus: 'DETECTED', toStatus: 'COLLECTED' }), 'FIRESTORE_TRANSPORT_ERROR');
  assert.equal(fromVm(await before.store.getJob(beforeJob.job.jobId)).status, 'DETECTED');

  const after = makeStore({ transportOptions: { failures: [{ op: 'updateDocument', timing: 'after' }] } });
  const afterJob = await createJob(after.store, createD2JobSeed({ jobId: 'synthetic-after-transition-failure' }));
  const request = { jobId: afterJob.job.jobId, expectedVersion: 1, fromStatus: 'DETECTED', toStatus: 'COLLECTED', idempotencyKey: 'synthetic-transition-after-lost' };
  await assertRejectCode(after.store.transitionJob(request), 'FIRESTORE_WRITE_UNCONFIRMED');
  const retry = fromVm(await after.store.transitionJob(request));
  assert.equal(retry.resultCode, 'IDEMPOTENT_TRANSITION_MATCH');
  assert.equal(retry.job.status, 'COLLECTED');
});

test('D2 failures while appending audit event and saving reconciliation report remain bounded', async () => {
  const audit = makeStore({ transportOptions: { failures: [{ op: 'appendDocument', timing: 'before' }] } });
  const auditJob = await createJob(audit.store, createD2JobSeed({ jobId: 'synthetic-audit-failure' }));
  await assertRejectCode(audit.store.appendAuditEvent({ jobId: auditJob.job.jobId, eventType: 'LOCAL_FAULT' }), 'FIRESTORE_TRANSPORT_ERROR');

  const report = makeStore({ transportOptions: { failures: [{ op: 'createDocument', timing: 'after', pathIncludes: 'reconciliationReports' }] } });
  const reportJob = await createJob(report.store, createD2JobSeed({ jobId: 'synthetic-report-failure' }));
  await assertRejectCode(report.store.saveReconciliationReport({ jobId: reportJob.job.jobId, expectedVersion: 1, report: createD2Report({ jobId: reportJob.job.jobId, reportId: 'rpt_uncertain' }) }), 'FIRESTORE_WRITE_UNCONFIRMED');
  const after = fromVm(await report.store.getJob(reportJob.job.jobId));
  assert.equal(after.status, 'DETECTED');
});

test('D2 version conflict during resume and two concurrent transition attempts allow only one winner', async () => {
  const { store } = makeStore();
  const created = await createJob(store, createD2JobSeed({ jobId: 'synthetic-concurrency-job' }));
  const winner = fromVm(await store.transitionJob({ jobId: created.job.jobId, expectedVersion: 1, fromStatus: 'DETECTED', toStatus: 'COLLECTED', idempotencyKey: 'winner' }));

  assert.equal(winner.job.version, 2);
  await assertRejectCode(store.transitionJob({ jobId: created.job.jobId, expectedVersion: 1, fromStatus: 'DETECTED', toStatus: 'COLLECTED', idempotencyKey: 'loser' }), 'DURABLE_JOB_VERSION_CONFLICT');
  await assertRejectCode(store.markReconciliationRequired({ jobId: created.job.jobId, expectedVersion: 1, errorCode: 'VERSION_CONFLICT_DURING_RESUME' }), 'DURABLE_JOB_VERSION_CONFLICT');
});

test('D2 duplicate request with same idempotency key does not create another transition', async () => {
  const { store } = makeStore();
  const created = await createJob(store, createD2JobSeed({ jobId: 'synthetic-idempotency-key-job' }));
  const request = { jobId: created.job.jobId, expectedVersion: 1, fromStatus: 'DETECTED', toStatus: 'COLLECTED', idempotencyKey: 'synthetic-idempotency-key' };
  const first = fromVm(await store.transitionJob(request));
  const second = fromVm(await store.transitionJob(request));

  assert.equal(first.resultCode, 'JOB_TRANSITIONED');
  assert.equal(second.resultCode, 'IDEMPOTENT_TRANSITION_MATCH');
  assert.equal(second.job.version, 2);
});

test('D2 same local scenario run twice is deterministic', async () => {
  async function scenario() {
    const { store, transport } = makeStore();
    const created = await createJob(store, createD2JobSeed({ jobId: 'synthetic-deterministic-job' }));
    await store.transitionJob({ jobId: created.job.jobId, expectedVersion: 1, fromStatus: 'DETECTED', toStatus: 'COLLECTED', idempotencyKey: 'synthetic-deterministic-transition' });
    await store.appendAuditEvent({ jobId: created.job.jobId, eventType: 'LOCAL_EVENT', actorType: 'SYSTEM' });
    return transport.dump();
  }

  assert.deepEqual(await scenario(), await scenario());
});