import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import { createFakeFirestoreTransport } from '../../fixtures/sgds-crit-003-d2/firestore-adapter-fixtures.mjs';
import {
  createD5BClock,
  createD5BCandidate,
  createD5BShadowFixtures,
  D5B_FAULT_INJECTION_CASES,
  D5B_TEST_SCENARIOS
} from '../../fixtures/durable-shadow/fake-durable-shadow.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['durableJobState.js', 'firestoreDurableJobStore.js', 'durableReconciliation.js', 'durableScannerShadowRunner.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const fromVm = (value) => JSON.parse(JSON.stringify(value));

const gas = loadGasSource({
  files: [
    'durableJobState.js',
    'durableReconciliation.js',
    'firestoreDurableJobStore.js',
    'durableScannerShadowRunner.js'
  ],
  exportNames: [
    'createDurableInvoiceJobStore',
    'createDurableScannerShadowRunner',
    'reconcileDurableInvoiceJobReportOnly',
    'D5B_LOCAL_SHADOW_ONLY',
    'D5B_PRODUCTION_MUTATION_ALLOWED_',
    'D5B_SHADOW_STATUSES_',
    'D5B_WOULD_MUTATE_STEPS_'
  ]
});

function makeHarness(options = {}) {
  const transport = options.transport || createFakeFirestoreTransport(options.transportOptions || {});
  const clock = options.clock || createD5BClock();
  const store = gas.call('createDurableInvoiceJobStore', transport, { clock });
  const fixtures = createD5BShadowFixtures(options.fixtures || {});
  const reconciliationService = options.reconciliationService || {
    reconcileDurableInvoiceJobReportOnly: gas.exports.reconcileDurableInvoiceJobReportOnly
  };
  const jobStore = options.decorateStore ? options.decorateStore(store) : store;
  const runner = gas.call('createDurableScannerShadowRunner', {
    gmailCandidateAdapter: fixtures.gmailCandidateAdapter,
    driveCandidateAdapter: fixtures.driveCandidateAdapter,
    sourceNormalizer: fixtures.sourceNormalizer,
    identityBuilder: fixtures.identityBuilder,
    commitPlanBuilder: options.commitPlanBuilder,
    jobStore,
    reconciliationService,
    clock
  });
  return { runner, fixtures, store: jobStore, rawStore: store, transport, clock };
}

function jobIdForIdentity(identityHash) {
  return `job_${fnv(identityHash)}`;
}

function fnv(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
}

async function runBatch(options = {}, batchOptions = {}) {
  const harness = makeHarness(options);
  const summary = fromVm(await harness.runner.runShadowDiscoveryBatch(batchOptions));
  return { ...harness, summary };
}

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

test('D5B exposes local-only shadow constants and scenario vocabulary', () => {
  assert.equal(gas.exports.D5B_LOCAL_SHADOW_ONLY, true);
  assert.equal(gas.exports.D5B_PRODUCTION_MUTATION_ALLOWED_, false);
  assert.deepEqual(fromVm(gas.exports.D5B_WOULD_MUTATE_STEPS_), ['DRIVE_XML', 'DRIVE_PDF', 'HOA_DON', 'LEDGER', 'GMAIL_LABEL']);
  assert.equal(D5B_TEST_SCENARIOS.length, 19);
  assert.equal(D5B_FAULT_INJECTION_CASES.length, 6);
});

test('D5B handles one Gmail candidate and one Drive candidate without mutation', async () => {
  const gmail = await runBatch();
  assert.equal(gmail.summary.discoveredCount, 1);
  assert.equal(gmail.summary.uniqueJobCount, 1);
  assert.equal(gmail.summary.results[0].status, 'SHADOW_READY');
  assert.equal(gmail.summary.results[0].expectedLineCount, 1);
  assert.match(gmail.summary.results[0].commitPlanHash, /^[0-9a-f]{8}$/);
  assert.equal(gmail.summary.mutationAttemptCount, 0);
  assert.deepEqual(gmail.fixtures.mutationCalls, []);

  const drive = await runBatch({ fixtures: { gmailCandidates: [], driveCandidates: [createD5BCandidate('DRIVE', 'driveHashA', 'A')] } });
  assert.equal(drive.summary.discoveredCount, 1);
  assert.equal(drive.summary.results[0].sourceType, 'DRIVE');
  assert.equal(drive.summary.results[0].status, 'SHADOW_READY');
  assert.equal(drive.summary.mutationAttemptCount, 0);
});

test('D5B converges same Gmail and Drive invoice to one deterministic job and keeps different invoices separate', async () => {
  const converged = await runBatch({
    fixtures: {
      gmailCandidates: [createD5BCandidate('GMAIL', 'gmailHashA', 'A')],
      driveCandidates: [createD5BCandidate('DRIVE', 'driveHashA', 'A')]
    }
  });
  assert.equal(converged.summary.discoveredCount, 2);
  assert.equal(converged.summary.uniqueJobCount, 1);
  assert.equal(converged.summary.duplicateCandidateCount, 1);
  assert.deepEqual([...new Set(converged.summary.results.map(result => result.jobId))].length, 1);

  const separate = await runBatch({
    fixtures: {
      gmailCandidates: [createD5BCandidate('GMAIL', 'gmailHashA', 'A')],
      driveCandidates: [createD5BCandidate('DRIVE', 'driveHashB', 'B')]
    }
  });
  assert.equal(separate.summary.discoveredCount, 2);
  assert.equal(separate.summary.uniqueJobCount, 2);
  assert.equal(separate.summary.duplicateCandidateCount, 0);
});

test('D5B duplicate Gmail and Drive discovery collapses and ordering is deterministic', async () => {
  async function scenario() {
    const run = await runBatch({
      fixtures: {
        gmailCandidates: [
          createD5BCandidate('GMAIL', 'gmailHashA', 'A', { discoveredAt: '2026-07-15T02:01:03.000Z' }),
          createD5BCandidate('GMAIL', 'gmailHashA', 'A', { discoveredAt: '2026-07-15T02:01:02.000Z' })
        ],
        driveCandidates: [
          createD5BCandidate('DRIVE', 'driveHashA', 'A', { discoveredAt: '2026-07-15T02:01:01.000Z' }),
          createD5BCandidate('DRIVE', 'driveHashA', 'A', { discoveredAt: '2026-07-15T02:01:04.000Z' })
        ]
      }
    });
    return run.summary.results.map(result => `${result.jobId}:${result.sourceType}:${result.sourceReferenceHash}:${result.status}`);
  }
  const first = await scenario();
  const second = await scenario();
  assert.deepEqual(first, second);
  assert.equal(first.some(line => line.includes('SHADOW_DUPLICATE_SOURCE')), true);
  assert.equal(first.some(line => line.includes('SHADOW_ALREADY_SEEN')), true);
});

test('D5B one candidate parse failure does not stop batch and batch limit is enforced', async () => {
  const isolated = await runBatch({
    fixtures: {
      gmailCandidates: [
        createD5BCandidate('GMAIL', 'missingHash', 'MISSING'),
        createD5BCandidate('GMAIL', 'gmailHashA', 'A')
      ]
    }
  });
  assert.equal(isolated.summary.discoveredCount, 2);
  assert.equal(isolated.summary.failedCount, 1);
  assert.equal(isolated.summary.readyCount, 1);

  const limited = await runBatch({
    fixtures: {
      gmailCandidates: [
        createD5BCandidate('GMAIL', 'gmailHashA', 'A', { discoveredAt: '2026-07-15T02:01:01.000Z' }),
        createD5BCandidate('GMAIL', 'gmailHashB', 'B', { discoveredAt: '2026-07-15T02:01:02.000Z' })
      ]
    }
  }, { candidateLimit: 1 });
  assert.equal(limited.summary.discoveredCount, 2);
  assert.equal(limited.summary.results.length, 1);
  assert.equal(limited.summary.uniqueJobCount, 1);
});

test('D5B commit-plan preview includes multi-line expected count and report-only reconciliation preview', async () => {
  const { summary } = await runBatch({ fixtures: { multiLine: true } });
  const result = summary.results[0];
  assert.equal(result.status, 'SHADOW_READY');
  assert.equal(result.expectedLineCount, 2);
  assert.match(result.commitPlanHash, /^[0-9a-f]{8}$/);
  assert.equal(result.reconciliationPreview.status, 'INCOMPLETE');
  assert.equal(result.wouldMutateSteps.includes('LEDGER'), true);
  assert.equal(result.mutationAttemptCount, 0);
});

test('D5B same candidate rerun is idempotent and terminal/reconciliation jobs are skipped', async () => {
  const harness = makeHarness();
  const first = fromVm(await harness.runner.runShadowDiscoveryBatch({}));
  const second = fromVm(await harness.runner.runShadowDiscoveryBatch({}));
  assert.equal(first.results[0].status, 'SHADOW_READY');
  assert.equal(second.results[0].status, 'SHADOW_READY');
  assert.equal(first.results[0].jobId, second.results[0].jobId);

  const completed = makeHarness();
  await completed.rawStore.createJobIfAbsent({
    jobId: jobIdForIdentity('syntheticIdentityA'),
    invoiceIdentityHash: 'syntheticIdentityA',
    sourceThreadHash: 'preexisting',
    status: 'COMPLETED'
  });
  const completedSummary = fromVm(await completed.runner.runShadowDiscoveryBatch({}));
  assert.equal(completedSummary.results[0].status, 'SHADOW_ALREADY_SEEN');

  const review = makeHarness();
  await review.rawStore.createJobIfAbsent({
    jobId: jobIdForIdentity('syntheticIdentityA'),
    invoiceIdentityHash: 'syntheticIdentityA',
    sourceThreadHash: 'preexisting',
    status: 'RECONCILIATION_REQUIRED'
  });
  const reviewSummary = fromVm(await review.runner.runShadowDiscoveryBatch({}));
  assert.equal(reviewSummary.results[0].status, 'SHADOW_REVIEW_REQUIRED');
});

test('D5B commit-plan mismatch and conflicting identity produce review required', async () => {
  const mismatchHarness = makeHarness();
  const preexisting = await mismatchHarness.rawStore.createJobIfAbsent({
    jobId: jobIdForIdentity('syntheticIdentityA'),
    invoiceIdentityHash: 'syntheticIdentityA',
    sourceThreadHash: 'preexisting',
    status: 'DETECTED'
  });
  await mismatchHarness.rawStore.saveCommitPlanIfAbsent({
    jobId: preexisting.job.jobId,
    expectedVersion: 1,
    commitPlan: {
      version: 'DURABLE_COMMIT_PLAN_V1',
      jobId: preexisting.job.jobId,
      legacyInvoiceKey: 'OTHER_LEGACY',
      invoiceKeyV2: 'OTHER_V2',
      expectedLineCount: 1,
      legacyHashIndexes: ['other-hash'],
      lineIdentityV2s: ['other-line'],
      lines: [{ sourceLineNo: 1, legacyHashIndex: 'other-hash', lineIdentityV2: 'other-line', immutableFields: {} }]
    }
  });
  const mismatch = fromVm(await mismatchHarness.runner.runShadowDiscoveryBatch({}));
  assert.equal(mismatch.results[0].status, 'SHADOW_REVIEW_REQUIRED');
  assert.equal(mismatch.results[0].findings.some(finding => finding.code.includes('IMMUTAB')), true);

  const conflict = await runBatch({ fixtures: { conflictingCandidateHash: 'gmailHashA' } });
  assert.equal(conflict.summary.results[0].status, 'SHADOW_REVIEW_REQUIRED');
  assert.equal(conflict.summary.results[0].findings.some(finding => finding.code.includes('IDENTITY_CONFLICT')), true);
});

test('D5B fault injection covers source, identity, store, and reconciliation failures', async () => {
  const cases = [
    { key: 'SOURCE_LOAD', expected: 'SHADOW_FAILED' },
    { key: 'PARSE', expected: 'SHADOW_FAILED' },
    { key: 'IDENTITY_BUILD', expected: 'SHADOW_REVIEW_REQUIRED' }
  ];
  for (const item of cases) {
    const run = await runBatch({ fixtures: { failures: { [item.key]: true } } });
    assert.equal(run.summary.results[0].status, item.expected, item.key);
  }

  const versionConflict = await runBatch({
    decorateStore(store) {
      return {
        ...store,
        async saveCommitPlanIfAbsent() {
          const error = new Error('shadow version conflict');
          error.code = 'DURABLE_JOB_VERSION_CONFLICT';
          throw error;
        }
      };
    }
  });
  assert.equal(versionConflict.summary.results[0].status, 'SHADOW_REVIEW_REQUIRED');

  const responseLost = await runBatch({
    decorateStore(store) {
      return {
        ...store,
        async saveCommitPlanIfAbsent() {
          const error = new Error('shadow commit plan response lost');
          error.code = 'FIRESTORE_WRITE_UNCONFIRMED';
          error.writeOutcome = 'UNKNOWN';
          throw error;
        }
      };
    }
  });
  assert.equal(responseLost.summary.results[0].status, 'SHADOW_FAILED');

  const reconciliationFailure = await runBatch({
    reconciliationService: {
      reconcileDurableInvoiceJobReportOnly() {
        const error = new Error('shadow reconciliation report failure');
        error.code = 'RECONCILIATION_REPORT_FAILURE';
        throw error;
      }
    }
  });
  assert.equal(reconciliationFailure.summary.results[0].status, 'SHADOW_FAILED');
});

test('D5B has zero mutation adapter calls, zero external API calls, and no scanner wiring', async () => {
  const { summary, fixtures } = await runBatch({
    fixtures: {
      gmailCandidates: [createD5BCandidate('GMAIL', 'gmailHashA', 'A')],
      driveCandidates: [createD5BCandidate('DRIVE', 'driveHashA', 'A')]
    }
  });
  assert.equal(summary.mutationAttemptCount, 0);
  assert.deepEqual(fixtures.mutationCalls, []);

  const source = fs.readFileSync('durableScannerShadowRunner.js', 'utf8');
  for (const forbidden of ['GmailApp', 'DriveApp', 'SpreadsheetApp', 'PropertiesService', 'UrlFetchApp', 'firebaseConfig', 'mainRun', 'commitPreparedInvoiceRows']) {
    assert.equal(source.includes(forbidden), false, `forbidden token present: ${forbidden}`);
  }
});

test('D5B same suite run twice is deterministic', async () => {
  async function scenario() {
    const { summary } = await runBatch({
      fixtures: {
        gmailCandidates: [createD5BCandidate('GMAIL', 'gmailHashA', 'A'), createD5BCandidate('GMAIL', 'gmailHashB', 'B')],
        driveCandidates: [createD5BCandidate('DRIVE', 'driveHashA', 'A')]
      }
    });
    return summary.results.map(result => `${result.status}:${result.jobId}:${result.commitPlanHash}:${result.mutationAttemptCount}`);
  }
  assert.deepEqual(await scenario(), await scenario());
});
