import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['durableJobState.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const fromVm = (value) => JSON.parse(JSON.stringify(value));

const gas = loadGasSource({
  files: ['durableJobState.js'],
  exportNames: [
    'assertDurableJobTransition_',
    'buildDurableCommitPlan_',
    'createLocalDurableJobStore_',
    'resolveDurableCompletedResume_',
    'isDurableTerminalJobState_'
  ]
});

function samplePlan(overrides = {}) {
  return gas.call('buildDurableCommitPlan_', {
    jobId: 'job-001',
    legacyInvoiceKey: '20260201_0100000001_C26THD8',
    invoiceKeyV2: '0100000001_C26THD8_8_20260201',
    lines: [
      {
        sourceLineNo: 1,
        legacyHashIndex: 'hash-line-1',
        lineIdentityV2: 'line-v2-1',
        immutableFields: { quantity: 1, unitPrice: 200, amount: 200 }
      },
      {
        sourceLineNo: 2,
        legacyHashIndex: 'hash-line-2',
        lineIdentityV2: 'line-v2-2',
        immutableFields: { quantity: 2, unitPrice: 300, amount: 600 }
      }
    ],
    hoaDonRegistryTarget: { legacyInvoiceKey: '20260201_0100000001_C26THD8' },
    driveEvidenceTargets: { xmlContentHash: 'xml-hash', pdfContentHash: 'pdf-hash' },
    preCommitLedgerProbe: { status: 'NO_ROWS_PRESENT' },
    ...overrides
  });
}

test('metadata', () => assert.equal(TEST_METADATA.testClass, 'REGRESSION_INVARIANT'));

test('D1 durable transition validator accepts only approved state path', () => {
  assert.equal(gas.call('assertDurableJobTransition_', 'DETECTED', 'COLLECTED'), true);
  assert.equal(gas.call('assertDurableJobTransition_', 'FILES_SAVED', 'COMMITTING'), true);
  assert.equal(gas.call('assertDurableJobTransition_', 'ROWS_COMMITTED', 'PROJECTIONS_COMMITTED'), true);
  assert.equal(gas.call('isDurableTerminalJobState_', 'COMPLETED'), true);

  assert.throws(
    () => gas.call('assertDurableJobTransition_', 'DETECTED', 'ROWS_COMMITTED'),
    /DURABLE_JOB_INVALID_TRANSITION:DETECTED->ROWS_COMMITTED/
  );
  assert.throws(
    () => gas.call('assertDurableJobTransition_', 'COMPLETED', 'COMMITTING'),
    /DURABLE_JOB_INVALID_TRANSITION:COMPLETED->COMMITTING/
  );
});

test('D1 commit plan builder records expected line and evidence summaries without mutating sheets', () => {
  const plan = samplePlan();

  assert.equal(plan.version, 'DURABLE_COMMIT_PLAN_V1');
  assert.equal(plan.expectedLineCount, 2);
  assert.deepEqual(fromVm(plan.legacyHashIndexes), ['hash-line-1', 'hash-line-2']);
  assert.deepEqual(fromVm(plan.lineIdentityV2s), ['line-v2-1', 'line-v2-2']);
  assert.equal(plan.preCommitLedgerProbe.status, 'NO_ROWS_PRESENT');
  assert.equal(plan.driveEvidenceTargets.xmlContentHash, 'xml-hash');

  assert.throws(
    () => gas.call('buildDurableCommitPlan_', { ...samplePlan(), lines: [] }),
    /DURABLE_COMMIT_PLAN_LINES_REQUIRED/
  );
});

test('D1 local durable store persists events and rejects changed commit plan', () => {
  const store = gas.call('createLocalDurableJobStore_', { now: () => '2026-07-15T00:00:00.000Z' });
  const job = store.createJob({
    jobId: 'job-001',
    sourceFingerprint: 'source-hash',
    invoiceKeyV2: '0100000001_C26THD8_8_20260201',
    legacyInvoiceKey: '20260201_0100000001_C26THD8'
  });

  assert.equal(job.state, 'DETECTED');
  assert.equal(store.transitionJob('job-001', 'COLLECTED').state, 'COLLECTED');
  assert.equal(store.transitionJob('job-001', 'PARSED').state, 'PARSED');
  assert.equal(store.transitionJob('job-001', 'VALIDATED').state, 'VALIDATED');

  const plan = samplePlan();
  assert.equal(store.saveCommitPlan('job-001', plan).expectedLineCount, 2);
  assert.equal(store.saveCommitPlan('job-001', samplePlan()).expectedLineCount, 2);

  const changedPlan = samplePlan({
    lines: [
      {
        sourceLineNo: 1,
        legacyHashIndex: 'hash-line-CHANGED',
        lineIdentityV2: 'line-v2-1',
        immutableFields: { quantity: 1, unitPrice: 200, amount: 200 }
      }
    ]
  });
  assert.throws(() => store.saveCommitPlan('job-001', changedPlan), /DURABLE_COMMIT_PLAN_IMMUTABLE:job-001/);

  const events = store.listEvents('job-001');
  assert.equal(events[0].type, 'JOB_CREATED');
  assert.ok(events.some(event => event.type === 'COMMIT_PLAN_SAVED'));
});

test('D1 completed job resume is idempotent only when ledger registry and projection verify', () => {
  const completed = { jobId: 'job-002', state: 'COMPLETED' };

  assert.deepEqual(
    fromVm(gas.call('resolveDurableCompletedResume_', completed, {
      ledgerVerified: true,
      registryVerified: true,
      projectionVerified: true
    })),
    { action: 'IDEMPOTENT_COMPLETE_NOOP', safeToMutate: false }
  );

  const unsafe = gas.call('resolveDurableCompletedResume_', completed, {
    ledgerVerified: true,
    registryVerified: false,
    projectionVerified: true
  });
  assert.equal(unsafe.action, 'RECONCILIATION_REQUIRED');
  assert.equal(unsafe.safeToMutate, false);
  assert.deepEqual(fromVm(unsafe.findingCodes), ['JOB_COMPLETED_BUT_PROJECTION_NOT_VERIFIED']);
});
