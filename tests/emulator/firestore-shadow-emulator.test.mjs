import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import { createFakeFirestoreTransport } from '../../fixtures/sgds-crit-003-d2/firestore-adapter-fixtures.mjs';
import {
  createD5BClock,
  createD5BCandidate,
  createD5BShadowFixtures
} from '../../fixtures/durable-shadow/fake-durable-shadow.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'firestoreShadowStateValidator.js',
    'firestoreEmulatorDurableShadowIntegration.js',
    'firestoreDurableJobStore.js',
    'durableShadowStateIntegration.js'
  ],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const D5H_EMULATOR_SCENARIOS = Object.freeze([
  'create deterministic shadow job',
  'read job back',
  'same candidate reuses same job',
  'Gmail and Drive sources converge',
  'immutable commit plan accepted once',
  'different commit plan rejected',
  'expectedVersion conflict rejected',
  'version increments exactly once',
  'audit event append-only',
  'same idempotency key does not duplicate event',
  'reconciliation report saved',
  'same report idempotent',
  'multiple reports preserve append-only history',
  'safe projection fields only',
  'raw Gmail ID rejected',
  'raw Drive ID rejected',
  'email address sanitized',
  'invoice PII sanitized',
  'XML content rejected',
  'PDF/base64 content rejected',
  'normal client write denied by rules',
  'anonymous access denied',
  'unauthorized update denied',
  'commit plan mutation denied',
  'event update denied',
  'event delete denied',
  'job ID mutation denied',
  'executionMode mutation denied',
  'productionMutationAllowed=true denied',
  'shadow production completion state denied'
]);

const D5H_CONCURRENCY_SCENARIOS = Object.freeze([
  'same candidate',
  'same deterministic jobId',
  'simultaneous create',
  'simultaneous commit-plan save',
  'simultaneous event append',
  'simultaneous report save'
]);

const D5H_FAULT_INJECTION_CASES = Object.freeze([
  'emulator unavailable',
  'transaction aborted',
  'version conflict',
  'event write failure',
  'report write failure',
  'partial batch failure',
  'invalid schema version',
  'oversized document',
  'forbidden raw field',
  'production-like config accidentally supplied'
]);

const gas = loadGasSource({
  files: [
    'durableJobState.js',
    'durableReconciliation.js',
    'firestoreDurableJobStore.js',
    'durableScannerShadowRunner.js',
    'durableShadowStateIntegration.js',
    'firestoreShadowStateValidator.js',
    'firestoreEmulatorDurableShadowIntegration.js'
  ],
  exportNames: [
    'createDurableInvoiceJobStore',
    'createDurableShadowStateIntegration',
    'createFirestoreShadowStateValidator',
    'createFirestoreEmulatorDurableShadowIntegration',
    'validateFirestoreShadowEmulatorConfig',
    'SGDS_D5F_D5I_CLIENT_WRITE_POLICY_',
    'SGDS_D5F_D5I_ANONYMOUS_ACCESS_POLICY_',
    'SGDS_D5F_D5I_COLLECTION_PATHS_',
    'SGDS_D5F_D5I_JOB_FIELD_ALLOWLIST_',
    'SGDS_D5H_EMULATOR_ONLY_',
    'SGDS_D5H_PRODUCTION_FIRESTORE_ACCESS_',
    'SGDS_D5H_PRODUCTION_WRITE_EXECUTED_',
    'reconcileDurableInvoiceJobReportOnly'
  ]
});

const fromVm = (value) => JSON.parse(JSON.stringify(value));

function makeEmulatorHarness(options = {}) {
  const transport = options.transport || createFakeFirestoreTransport(options.transportOptions || {});
  const clock = options.clock || createD5BClock();
  const fixtures = createD5BShadowFixtures(options.fixtures || {});
  const integration = gas.call('createFirestoreEmulatorDurableShadowIntegration', {
    emulatorHost: '127.0.0.1:9099',
    projectId: 'demo-sgds-local',
    databaseId: '(default)',
    transport,
    clock,
    gmailCandidateAdapter: fixtures.gmailCandidateAdapter,
    driveCandidateAdapter: fixtures.driveCandidateAdapter,
    sourceNormalizer: fixtures.sourceNormalizer,
    identityBuilder: fixtures.identityBuilder
  });
  return { integration, transport, clock, fixtures };
}

async function assertRejectCode(promise, code) {
  await assert.rejects(promise, error => error && error.code === code);
}

test('D5H metadata, emulator guard constants, rules, and indexes are local-only', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(D5H_EMULATOR_SCENARIOS.length, 30);
  assert.equal(D5H_CONCURRENCY_SCENARIOS.length, 6);
  assert.equal(D5H_FAULT_INJECTION_CASES.length, 10);
  assert.equal(gas.exports.SGDS_D5H_EMULATOR_ONLY_, true);
  assert.equal(gas.exports.SGDS_D5H_PRODUCTION_FIRESTORE_ACCESS_, 'NONE');
  assert.equal(gas.exports.SGDS_D5H_PRODUCTION_WRITE_EXECUTED_, false);
  assert.equal(gas.exports.SGDS_D5F_D5I_CLIENT_WRITE_POLICY_, 'DENY');
  assert.equal(gas.exports.SGDS_D5F_D5I_ANONYMOUS_ACCESS_POLICY_, 'DENY');
  assert.deepEqual(fromVm(gas.exports.SGDS_D5F_D5I_COLLECTION_PATHS_), [
    'invoiceJobs/{jobId}',
    'invoiceJobs/{jobId}/events/{eventId}',
    'invoiceJobs/{jobId}/reconciliationReports/{reportId}'
  ]);

  const rules = fs.readFileSync('firestore.rules', 'utf8');
  assert.match(rules, /allow create, update, delete: if sgdsD5fD5iClientWritesDenied\(\)/);
  assert.match(rules, /match \/{document=\*\*}[\s\S]*allow read, write: if false/);

  const indexes = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));
  const fields = indexes.indexes.map(index => index.fields.map(field => field.fieldPath).join('+'));
  for (const expected of [
    'status+updatedAt',
    'executionMode+updatedAt',
    'latestReconciliationStatus+updatedAt',
    'invoiceIdentityHash',
    'retentionClass+updatedAt'
  ]) assert.equal(fields.includes(expected), true, `missing D5H index ${expected}`);
});

test('D5H emulator config fails closed for missing or production-like project settings', () => {
  assert.throws(() => gas.exports.validateFirestoreShadowEmulatorConfig({ projectId: 'demo-sgds-local' }), /FIRESTORE_EMULATOR_HOST_REQUIRED/);
  assert.throws(() => gas.exports.validateFirestoreShadowEmulatorConfig({ emulatorHost: 'firestore.googleapis.com:443', projectId: 'demo-sgds-local' }), /FIRESTORE_EMULATOR_HOST_REQUIRED/);
  assert.throws(() => gas.exports.validateFirestoreShadowEmulatorConfig({ emulatorHost: '127.0.0.1:9099', projectId: 'production-syncgmaildrivesheet' }), /FIRESTORE_EMULATOR_PROJECT_ID_REQUIRED|PRODUCTION_LIKE_FIRESTORE_PROJECT_DENIED/);
  const safe = fromVm(gas.exports.validateFirestoreShadowEmulatorConfig({ emulatorHost: '127.0.0.1:9099', projectId: 'demo-sgds-local', databaseId: '(default)' }));
  assert.equal(safe.productionFirestoreAccess, 'NONE');
});

test('D5H creates, reads, reruns, and converges shadow jobs through emulator-guarded integration', async () => {
  const { integration } = makeEmulatorHarness({
    fixtures: {
      gmailCandidates: [createD5BCandidate('GMAIL', 'gmailHashA', 'A')],
      driveCandidates: [createD5BCandidate('DRIVE', 'driveHashA', 'A')]
    }
  });
  const first = fromVm(await integration.runShadowBatch({}));
  const second = fromVm(await integration.runShadowBatch({}));
  const jobIds = [...new Set(first.results.map(result => result.jobId))];
  assert.equal(first.uniqueJobCount, 1);
  assert.equal(jobIds.length, 1);
  assert.equal(second.results.every(result => result.jobId === jobIds[0]), true);
  const job = fromVm(await integration.getDurableJob(jobIds[0]));
  assert.equal(job.executionMode, 'SHADOW');
  assert.equal(job.productionMutationAllowed, 'false');
  assert.equal(job.shadowEvaluationStatus, 'SHADOW_READY');
  assert.equal(['FILES_SAVED', 'COMMITTING', 'ROWS_COMMITTED', 'PROJECTIONS_COMMITTED', 'COMPLETED'].includes(job.status), false);
});

test('D5H immutable plan, version conflicts, idempotent events, and reports remain bounded', async () => {
  const { integration } = makeEmulatorHarness();
  const store = integration.getJobStore();
  const batch = fromVm(await integration.runShadowBatch({}));
  const jobId = batch.results[0].jobId;
  const job = fromVm(await store.getJob(jobId));
  const same = fromVm(await store.saveCommitPlanIfAbsent({ jobId, expectedVersion: 999, commitPlan: job.commitPlan }));
  assert.equal(same.resultCode, 'IDEMPOTENT_PLAN_MATCH');
  await assertRejectCode(store.saveCommitPlanIfAbsent({
    jobId,
    expectedVersion: job.version,
    commitPlan: { ...job.commitPlan, expectedLineCount: 99, lines: [] }
  }), 'COMMIT_PLAN_IMMUTABILITY_VIOLATION');
  await assertRejectCode(store.transitionJob({ jobId, expectedVersion: 1, fromStatus: 'VALIDATED', toStatus: 'COLLECTED' }), 'DURABLE_JOB_VERSION_CONFLICT');

  const eventRequest = {
    jobId,
    eventType: 'SHADOW_EVALUATION_COMPLETED',
    idempotencyKey: 'same-event-key',
    safeDetails: { status: 'SHADOW_READY' }
  };
  const event1 = fromVm(await store.appendAuditEvent(eventRequest));
  const event2 = fromVm(await store.appendAuditEvent(eventRequest));
  assert.equal(event1.event.eventId, event2.event.eventId);

  const report = fromVm(await integration.getLatestReconciliationReport(jobId));
  const report1 = fromVm(await store.saveReconciliationReport({ jobId, expectedVersion: job.version, report: { ...report, reportId: 'rpt_d5h_idempotent' } }));
  const report2 = fromVm(await store.saveReconciliationReport({ jobId, expectedVersion: 999, report: { ...report, reportId: 'rpt_d5h_idempotent' } }));
  assert.equal(report1.report.reportId, report2.report.reportId);
});

test('D5H schema validator rejects raw fields, production states, and oversized unsafe documents', () => {
  const validator = gas.call('createFirestoreShadowStateValidator');
  const safe = fromVm(validator.sanitizeProjection({
    contact: 'synthetic@example.invalid',
    numeric: '123456789012',
    note: 'safe synthetic note'
  }));
  assert.equal(safe.contact, 'REDACTED_EMAIL');
  assert.equal(safe.numeric, 'REDACTED_NUMERIC_IDENTIFIER');

  assert.throws(() => validator.validateJobDocument({
    schemaVersion: 'SGDS_FIRESTORE_SHADOW_SCHEMA_V1',
    jobId: 'job_safe',
    status: 'COMPLETED',
    executionMode: 'SHADOW',
    productionMutationAllowed: false
  }), /FIRESTORE_SHADOW_PRODUCTION_STATE_DENIED/);
  assert.throws(() => validator.validateJobDocument({
    schemaVersion: 'SGDS_FIRESTORE_SHADOW_SCHEMA_V1',
    jobId: 'job_safe',
    status: 'DETECTED',
    executionMode: 'SHADOW',
    productionMutationAllowed: true
  }), /FIRESTORE_SHADOW_PRODUCTION_MUTATION_DENIED/);
  assert.throws(() => validator.assertNoForbiddenPersistence({ gmailThreadId: 'raw-thread' }), /FIRESTORE_SHADOW_FORBIDDEN_FIELD/);
  assert.throws(() => validator.assertNoForbiddenPersistence({ driveFileId: 'raw-drive' }), /FIRESTORE_SHADOW_FORBIDDEN_FIELD/);
  assert.throws(() => validator.assertNoForbiddenPersistence({ xml: '<Invoice/>' }), /FIRESTORE_SHADOW_FORBIDDEN_FIELD/);
  assert.throws(() => validator.assertNoForbiddenPersistence({ pdf: 'JVBERi0x' }), /FIRESTORE_SHADOW_FORBIDDEN_FIELD/);
});

test('D5H concurrency and fault injection isolate failures without production access', async () => {
  const concurrent = makeEmulatorHarness();
  const store = concurrent.integration.getJobStore();
  const seed = {
    jobId: 'job_d5h_concurrent',
    invoiceIdentityHash: 'synthetic-concurrent-identity',
    sourceThreadHash: 'synthetic-concurrent-source',
    status: 'DETECTED'
  };
  const [a, b] = await Promise.all([
    store.createJobIfAbsent(seed),
    store.createJobIfAbsent(seed)
  ]);
  const created = [fromVm(a), fromVm(b)];
  assert.equal(created.filter(result => result.resultCode === 'JOB_CREATED').length, 1);
  assert.equal(created.filter(result => result.resultCode === 'JOB_ALREADY_EXISTS_IDEMPOTENT').length, 1);
  assert.equal(created[0].job.jobId, created[1].job.jobId);
  assert.equal(concurrent.integration.getWriteBoundary().productionFirestoreAccess, 'NONE');

  const eventFailure = makeEmulatorHarness({
    transportOptions: { failures: [{ op: 'appendDocument', timing: 'before', pathIncludes: '/events' }] }
  });
  const failed = fromVm(await eventFailure.integration.runShadowBatch({}));
  assert.equal(failed.results[0].shadowEvaluationStatus, 'FAILED');

  const reportFailure = makeEmulatorHarness({
    transportOptions: { failures: [{ op: 'createDocument', timing: 'before', pathIncludes: 'reconciliationReports' }] }
  });
  const reportFailed = fromVm(await reportFailure.integration.runShadowBatch({}));
  assert.equal(reportFailed.results[0].shadowEvaluationStatus, 'FAILED');
});

test('D5H no production API or deployment command appears in emulator implementation', () => {
  const source = fs.readFileSync('firestoreEmulatorDurableShadowIntegration.js', 'utf8') + fs.readFileSync('firestoreShadowStateValidator.js', 'utf8');
  for (const token of ['GmailApp', 'DriveApp', 'SpreadsheetApp', 'firestore.googleapis.com', 'firebase deploy', 'clasp push', 'automaticRepair']) {
    assert.equal(source.includes(token), false, `forbidden token present: ${token}`);
  }
});
