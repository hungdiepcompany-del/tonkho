import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import { createD3Fixture, D3_EXPECTED_CODES, D3_FIXTURE_NAMES } from '../../fixtures/sgds-crit-003-d3/reconciliation-fixtures.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['durableJobState.js', 'durableReconciliation.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const REQUIRED_CODES = Object.freeze([
  'JOB_MISSING',
  'COMMIT_PLAN_MISSING',
  'COMMIT_PLAN_HASH_MISMATCH',
  'COMMIT_PLAN_VERSION_MISMATCH',
  'STATE_AHEAD_OF_EVIDENCE',
  'STATE_BEHIND_EVIDENCE',
  'TERMINAL_STATE_CONFLICT',
  'DRIVE_XML_MISSING',
  'DRIVE_PDF_MISSING',
  'DRIVE_ARTIFACT_DUPLICATE',
  'DRIVE_CONTENT_HASH_MISMATCH',
  'HOA_DON_ROW_MISSING',
  'HOA_DON_ROW_DUPLICATE',
  'HOA_DON_FILE_REFERENCE_MISMATCH',
  'LEDGER_ROWS_MISSING',
  'LEDGER_ROWS_EXTRA',
  'LEDGER_LINE_HASH_MISMATCH',
  'LEDGER_INVOICE_KEY_MISMATCH',
  'LEDGER_DUPLICATE_LINE_IDENTITY',
  'GMAIL_FALSE_SAVED_LABEL',
  'GMAIL_SAVED_LABEL_MISSING',
  'GMAIL_PENDING_LABEL_CONFLICT'
]);

const fromVm = (value) => JSON.parse(JSON.stringify(value));
const clone = (value) => JSON.parse(JSON.stringify(value));

const gas = loadGasSource({
  files: ['durableJobState.js', 'durableReconciliation.js'],
  exportNames: [
    'reconcileDurableInvoiceJobReportOnly',
    'DURABLE_RECONCILIATION_FINDING_CODES_',
    'assertDurableJobTransition_',
    'buildDurableCommitPlan_',
    'createLocalDurableJobStore_',
    'resolveDurableCompletedResume_'
  ]
});

function reconcile(fixture) {
  return fromVm(gas.call('reconcileDurableInvoiceJobReportOnly', fixture));
}

function codes(report) {
  return report.findings.map(finding => finding.code);
}

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

test('D3 exposes the full report-only finding-code vocabulary', () => {
  assert.deepEqual(fromVm(gas.exports.DURABLE_RECONCILIATION_FINDING_CODES_), REQUIRED_CODES);
});

test('D3 returns CONSISTENT for a completed synthetic multi-line invoice with matching evidence', () => {
  const report = reconcile(createD3Fixture('allSystemsConsistent'));
  assert.equal(report.status, 'CONSISTENT');
  assert.equal(report.findingCount, 0);
  assert.equal(report.blockerCount, 0);
  assert.equal(report.jobId.startsWith('job_'), true);
  assert.match(report.invoiceKeyHashPrefix, /^[0-9a-f]{8}$/);
});

test('D3 fault fixtures emit deterministic expected code order without leaking raw invoice keys', () => {
  for (const name of D3_FIXTURE_NAMES) {
    const fixture = createD3Fixture(name);
    const before = clone(fixture);
    const report = reconcile(fixture);
    const observedCodes = codes(report);
    assert.deepEqual(fixture, before, `${name} input mutated`);
    assert.deepEqual(observedCodes, [...observedCodes].sort((a, b) => REQUIRED_CODES.indexOf(a) - REQUIRED_CODES.indexOf(b)), `${name} code order is not deterministic`);
    assert.deepEqual(observedCodes, D3_EXPECTED_CODES[name], `${name} finding codes changed`);
    for (const finding of report.findings) {
      assert.ok(['REPORT_ONLY', 'OWNER_REVIEW_REQUIRED'].includes(finding.repairPolicy), `${name} has unsupported policy`);
      assert.equal(finding.safeMessage.includes('SYNTHETIC_INVOICE_KEY_V2'), false, `${name} leaked invoice key in safeMessage`);
      assert.equal(finding.safeMessage.includes('SYNTHETIC_LEGACY_INVOICE_KEY'), false, `${name} leaked legacy key in safeMessage`);
    }
  }
});

test('D3 same input reconciled twice returns equivalent report and never changes commit plan', () => {
  const fixture = createD3Fixture('sameInputReconciledTwice');
  const planBefore = clone(fixture.commitPlan);
  const first = reconcile(fixture);
  const second = reconcile(fixture);
  assert.deepEqual(first, second);
  assert.deepEqual(fixture.commitPlan, planBefore);
});

test('D3 classifies incomplete and conflicted partial states without automatic repair', () => {
  assert.equal(reconcile(createD3Fixture('partialLedgerLineCommit')).status, 'CONFLICTED');
  assert.equal(reconcile(createD3Fixture('driveSavedHoaDonMissing')).status, 'CONFLICTED');
  assert.equal(reconcile(createD3Fixture('extraLedgerLine')).status, 'REVIEW_REQUIRED');
  assert.equal(reconcile(createD3Fixture('jobBehindObservedEvidence')).status, 'REVIEW_REQUIRED');
});

test('D3 detects missing job and commit plan in a report-only shape', () => {
  const report = reconcile({ generatedAt: '2026-07-15T00:00:00.000Z', observed: {} });
  assert.deepEqual(codes(report), ['JOB_MISSING', 'COMMIT_PLAN_MISSING']);
  assert.equal(report.status, 'CONFLICTED');
  assert.equal(report.findings.every(finding => finding.repairPolicy === 'OWNER_REVIEW_REQUIRED'), true);
});

test('D3 detects commit plan version mismatch without mutating the input plan', () => {
  const fixture = createD3Fixture('allSystemsConsistent');
  fixture.job.commitPlan = null;
  fixture.commitPlan.version = 'DURABLE_COMMIT_PLAN_V0';
  const before = clone(fixture.commitPlan);
  const report = reconcile(fixture);
  assert.equal(codes(report).includes('COMMIT_PLAN_VERSION_MISMATCH'), true);
  assert.deepEqual(fixture.commitPlan, before);
});

test('D3 observes external API stubs only as unavailable and performs no store writes', () => {
  const fixture = createD3Fixture('allSystemsConsistent');
  const report = reconcile(fixture);
  assert.equal(report.status, 'CONSISTENT');
  assert.equal(typeof fixture.store, 'undefined');
  assert.equal(typeof fixture.writeBatch, 'undefined');
});

test('D3 preserves D1 durable-state regressions: illegal transition, completed resume, immutable saved plan', () => {
  assert.throws(
    () => gas.call('assertDurableJobTransition_', 'DETECTED', 'ROWS_COMMITTED'),
    /DURABLE_JOB_INVALID_TRANSITION:DETECTED->ROWS_COMMITTED/
  );

  assert.deepEqual(
    fromVm(gas.call('resolveDurableCompletedResume_', { jobId: 'synthetic-job-002', state: 'COMPLETED' }, {
      ledgerVerified: true,
      registryVerified: true,
      projectionVerified: true
    })),
    { action: 'IDEMPOTENT_COMPLETE_NOOP', safeToMutate: false }
  );

  const store = gas.call('createLocalDurableJobStore_', { now: () => '2026-07-15T00:00:00.000Z' });
  store.createJob({
    jobId: 'synthetic-job-003',
    legacyInvoiceKey: 'SYNTHETIC_LEGACY_INVOICE_KEY',
    invoiceKeyV2: 'SYNTHETIC_INVOICE_KEY_V2'
  });
  const plan = gas.call('buildDurableCommitPlan_', {
    jobId: 'synthetic-job-003',
    legacyInvoiceKey: 'SYNTHETIC_LEGACY_INVOICE_KEY',
    invoiceKeyV2: 'SYNTHETIC_INVOICE_KEY_V2',
    lines: [{ legacyHashIndex: 'synthetic-line-hash-1', lineIdentityV2: 'synthetic-line-id-1' }]
  });
  store.saveCommitPlan('synthetic-job-003', plan);
  const changed = clone(fromVm(plan));
  changed.lines[0].legacyHashIndex = 'synthetic-changed-line-hash';
  changed.legacyHashIndexes[0] = 'synthetic-changed-line-hash';
  assert.throws(() => store.saveCommitPlan('synthetic-job-003', changed), /DURABLE_COMMIT_PLAN_IMMUTABLE:synthetic-job-003/);
});