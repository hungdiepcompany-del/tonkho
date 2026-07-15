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
    'durableJobState.js',
    'firestoreDurableJobStore.js',
    'durableReconciliation.js',
    'durableScannerShadowRunner.js',
    'durableShadowStateIntegration.js'
  ],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const D5E_TEST_SCENARIOS = Object.freeze([
  'single Gmail candidate creates one durable shadow job',
  'single Drive candidate creates one durable shadow job',
  'Gmail and Drive converge to one job',
  'same candidate rerun is idempotent',
  'same invoice from two sources keeps merged provenance',
  'commit plan immutable',
  'commit plan mismatch requires review',
  'version conflict isolated',
  'audit events append-only',
  'duplicate audit events bounded',
  'reconciliation report saved',
  'reconciliation findings deterministic',
  'report-only mode never repairs',
  'completed production state not fabricated',
  'shadow job does not enter production commit states',
  'raw Gmail IDs not persisted',
  'raw Drive IDs not persisted',
  'invoice PII not persisted',
  'XML/PDF contents not persisted',
  'batch isolation',
  'one failed candidate does not fail entire batch',
  'mutation attempt count zero',
  'production API call count zero',
  'production Firestore call count zero'
]);

const D5E_FAULT_INJECTION_CASES = Object.freeze([
  'job create conflict',
  'commit plan save conflict',
  'audit append failure',
  'report save failure',
  'candidate normalization failure',
  'identity derivation failure'
]);

const gas = loadGasSource({
  files: [
    'durableJobState.js',
    'durableReconciliation.js',
    'firestoreDurableJobStore.js',
    'durableScannerShadowRunner.js',
    'durableShadowStateIntegration.js'
  ],
  exportNames: [
    'createDurableInvoiceJobStore',
    'createDurableScannerShadowRunner',
    'createDurableShadowStateIntegration',
    'reconcileDurableInvoiceJobReportOnly',
    'D5E_LOCAL_ONLY',
    'D5E_EXECUTION_MODE_',
    'D5E_PRODUCTION_MUTATION_ALLOWED_',
    'D5E_AUDIT_EVENTS_',
    'D5E_RETENTION_AND_SANITIZATION_POLICY_'
  ]
});

const fromVm = (value) => JSON.parse(JSON.stringify(value));

function makeHarness(options = {}) {
  const transport = options.transport || createFakeFirestoreTransport(options.transportOptions || {});
  const clock = options.clock || createD5BClock();
  const rawStore = gas.call('createDurableInvoiceJobStore', transport, { clock });
  const fixtures = createD5BShadowFixtures(options.fixtures || {});
  const reconciliationService = options.reconciliationService || {
    reconcileDurableInvoiceJobReportOnly: gas.exports.reconcileDurableInvoiceJobReportOnly
  };
  const jobStore = options.decorateStore ? options.decorateStore(rawStore) : rawStore;
  const integration = gas.call('createDurableShadowStateIntegration', {
    gmailCandidateAdapter: fixtures.gmailCandidateAdapter,
    driveCandidateAdapter: fixtures.driveCandidateAdapter,
    sourceNormalizer: fixtures.sourceNormalizer,
    identityBuilder: fixtures.identityBuilder,
    commitPlanBuilder: options.commitPlanBuilder,
    jobStore,
    reconciliationService,
    clock
  });
  return { integration, fixtures, store: jobStore, rawStore, transport, clock };
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
  const summary = fromVm(await harness.integration.runShadowBatch(batchOptions));
  return { ...harness, summary };
}

test('metadata and D5E local-only constants', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(D5E_TEST_SCENARIOS.length, 24);
  assert.equal(D5E_FAULT_INJECTION_CASES.length, 6);
  assert.equal(gas.exports.D5E_LOCAL_ONLY, true);
  assert.equal(gas.exports.D5E_EXECUTION_MODE_, 'SHADOW');
  assert.equal(gas.exports.D5E_PRODUCTION_MUTATION_ALLOWED_, false);
  assert.deepEqual(fromVm(gas.exports.D5E_AUDIT_EVENTS_), [
    'SHADOW_CANDIDATE_DISCOVERED',
    'SHADOW_SOURCE_NORMALIZED',
    'SHADOW_IDENTITY_DERIVED',
    'SHADOW_JOB_CREATED',
    'SHADOW_JOB_REUSED',
    'SHADOW_COMMIT_PLAN_SAVED',
    'SHADOW_COMMIT_PLAN_REUSED',
    'SHADOW_RECONCILIATION_RECORDED',
    'SHADOW_REVIEW_REQUIRED',
    'SHADOW_EVALUATION_COMPLETED'
  ]);
});

test('D5E creates Gmail and Drive durable shadow jobs with report-only state', async () => {
  const gmail = await runBatch();
  assert.equal(gmail.summary.discoveredCount, 1);
  assert.equal(gmail.summary.uniqueJobCount, 1);
  assert.equal(gmail.summary.results[0].shadowEvaluationStatus, 'READY');
  assert.equal(gmail.summary.results[0].durableJobStatus, 'VALIDATED');
  assert.equal(gmail.summary.results[0].mutationAttemptCount, 0);

  const job = fromVm(await gmail.integration.getDurableJob(gmail.summary.results[0].jobId));
  assert.equal(job.status, 'VALIDATED');
  assert.equal(job.executionMode, 'SHADOW');
  assert.equal(job.productionMutationAllowed, 'false');
  assert.equal(['FILES_SAVED', 'COMMITTING', 'ROWS_COMMITTED', 'PROJECTIONS_COMMITTED', 'COMPLETED'].includes(job.status), false);

  const report = fromVm(await gmail.integration.getLatestReconciliationReport(job.jobId));
  assert.equal(report.executionMode, 'SHADOW');
  assert.equal(report.repairPolicy, 'REPORT_ONLY');
  assert.equal(report.inputSnapshotVersion, 'D5E_SHADOW_STATE_SNAPSHOT_V1');

  const drive = await runBatch({ fixtures: { gmailCandidates: [], driveCandidates: [createD5BCandidate('DRIVE', 'driveHashA', 'A')] } });
  assert.equal(drive.summary.results[0].sourceType, 'DRIVE');
  assert.equal(drive.summary.results[0].shadowEvaluationStatus, 'READY');
});

test('D5E converges Gmail and Drive to one deterministic job with bounded audit provenance', async () => {
  const run = await runBatch({
    fixtures: {
      gmailCandidates: [createD5BCandidate('GMAIL', 'gmailHashA', 'A')],
      driveCandidates: [createD5BCandidate('DRIVE', 'driveHashA', 'A')]
    }
  });
  const jobIds = [...new Set(run.summary.results.map(result => result.jobId))];
  assert.equal(jobIds.length, 1);
  assert.equal(run.summary.uniqueJobCount, 1);
  const events = fromVm(run.integration.listAuditEvents(jobIds[0]));
  assert.equal(events.some(event => event.eventType === 'SHADOW_CANDIDATE_DISCOVERED' && event.safeDetails.sourceType === 'GMAIL'), true);
  assert.equal(events.some(event => event.eventType === 'SHADOW_CANDIDATE_DISCOVERED' && event.safeDetails.sourceType === 'DRIVE'), true);
  assert.equal(events.length <= 20, true);
});

test('D5E rerun is idempotent with same job, same commit plan, bounded audit, and deterministic findings', async () => {
  const harness = makeHarness();
  const first = fromVm(await harness.integration.runShadowBatch({}));
  const second = fromVm(await harness.integration.runShadowBatch({}));
  const jobId = first.results[0].jobId;
  assert.equal(second.results[0].jobId, jobId);
  assert.equal(second.results[0].commitPlanHash, first.results[0].commitPlanHash);
  assert.deepEqual(second.results[0].findingCodes, first.results[0].findingCodes);
  assert.equal(fromVm(harness.integration.listAuditEvents(jobId)).length <= 10, true);
});

test('D5E immutable commit plan mismatch and version conflict require review without production completion', async () => {
  const mismatchHarness = makeHarness();
  const jobId = jobIdForIdentity('syntheticIdentityA');
  const created = await mismatchHarness.rawStore.createJobIfAbsent({
    jobId,
    invoiceIdentityHash: 'syntheticIdentityA',
    sourceThreadHash: 'preexisting',
    status: 'DETECTED'
  });
  await mismatchHarness.rawStore.saveCommitPlanIfAbsent({
    jobId,
    expectedVersion: created.job.version,
    commitPlan: {
      version: 'DURABLE_COMMIT_PLAN_V1',
      jobId,
      legacyInvoiceKey: 'OTHER_LEGACY',
      invoiceKeyV2: 'OTHER_V2',
      expectedLineCount: 1,
      legacyHashIndexes: ['other-hash'],
      lineIdentityV2s: ['other-line'],
      lines: [{ sourceLineNo: 1, legacyHashIndex: 'other-hash', lineIdentityV2: 'other-line', immutableFields: {} }]
    }
  });
  const mismatch = fromVm(await mismatchHarness.integration.runShadowBatch({}));
  assert.equal(mismatch.results[0].shadowEvaluationStatus, 'REVIEW_REQUIRED');
  assert.equal(mismatch.results[0].findingCodes.some(code => code.includes('IMMUTAB') || code === 'COMMIT_PLAN_MISMATCH'), true);

  const conflict = await runBatch({
    decorateStore(store) {
      return {
        ...store,
        async transitionJob(request) {
          if (request.toStatus === 'COLLECTED') {
            const error = new Error('synthetic version conflict');
            error.code = 'DURABLE_JOB_VERSION_CONFLICT';
            throw error;
          }
          return store.transitionJob(request);
        }
      };
    }
  });
  assert.equal(conflict.summary.results[0].shadowEvaluationStatus, 'FAILED');
  assert.equal(conflict.summary.results[0].findingCodes.includes('DURABLE_JOB_VERSION_CONFLICT'), true);
});

test('D5E fault injection isolates audit, report, normalization, identity, and candidate failures', async () => {
  const sourceFailure = await runBatch({
    fixtures: {
      gmailCandidates: [createD5BCandidate('GMAIL', 'missingHash', 'MISSING'), createD5BCandidate('GMAIL', 'gmailHashA', 'A')]
    }
  });
  assert.equal(sourceFailure.summary.failedCount, 1);
  assert.equal(sourceFailure.summary.readyCount, 1);

  const identityFailure = await runBatch({ fixtures: { failures: { IDENTITY_BUILD: true } } });
  assert.equal(identityFailure.summary.results[0].shadowEvaluationStatus, 'REVIEW_REQUIRED');

  const auditFailure = await runBatch({
    transportOptions: { failures: [{ op: 'appendDocument', timing: 'before', pathIncludes: '/events' }] }
  });
  assert.equal(auditFailure.summary.results[0].shadowEvaluationStatus, 'FAILED');

  const reportFailure = await runBatch({
    transportOptions: { failures: [{ op: 'createDocument', timing: 'before', pathIncludes: 'reconciliationReports' }] }
  });
  assert.equal(reportFailure.summary.results[0].shadowEvaluationStatus, 'FAILED');

  const discoveryFailure = await runBatch({ fixtures: { failures: { GMAIL_DISCOVERY: true } } });
  assert.equal(discoveryFailure.summary.failedCount, 1);
});

test('D5E sanitizes raw identifiers, PII, and source payloads from durable job/events/report', async () => {
  const run = await runBatch({
    fixtures: {
      gmailCandidates: [{
        ...createD5BCandidate('GMAIL', 'gmailHashA', 'A'),
        rawGmailId: 'RAW_GMAIL_ID_FORBIDDEN',
        rawDriveId: 'RAW_DRIVE_ID_FORBIDDEN',
        emailBody: 'secret body',
        xmlText: '<xml>secret</xml>',
        pdfText: 'secret pdf',
        safeMetadata: {
          syntheticInvoiceKey: 'A',
          contact: 'synthetic@example.invalid',
          taxCode: '0123456789'
        }
      }]
    }
  });
  const jobId = run.summary.results[0].jobId;
  const payload = JSON.stringify({
    job: fromVm(await run.integration.getDurableJob(jobId)),
    events: fromVm(run.integration.listAuditEvents(jobId)),
    report: fromVm(await run.integration.getLatestReconciliationReport(jobId))
  });
  for (const forbidden of ['RAW_GMAIL_ID_FORBIDDEN', 'RAW_DRIVE_ID_FORBIDDEN', 'secret body', '<xml>secret</xml>', 'secret pdf', 'synthetic@example.invalid', '0123456789']) {
    assert.equal(payload.includes(forbidden), false, forbidden);
  }
});

test('D5E never calls production APIs, production Firestore, repair, or scanner/main wiring', async () => {
  const { summary, fixtures } = await runBatch();
  assert.equal(summary.mutationAttemptCount, 0);
  assert.deepEqual(fixtures.mutationCalls, []);
  assert.equal(summary.results[0].productionFirestoreAccess, 'NONE');
  assert.equal(summary.results[0].productionFirestoreWrite, 'NONE');
  assert.equal(summary.results[0].gmailApiCall, 'NONE');
  assert.equal(summary.results[0].driveApiCall, 'NONE');
  assert.equal(summary.results[0].sheetsApiCall, 'NONE');

  const source = fs.readFileSync('durableShadowStateIntegration.js', 'utf8');
  for (const forbidden of ['GmailApp', 'DriveApp', 'SpreadsheetApp', 'PropertiesService', 'UrlFetchApp', 'firebaseConfig', 'mainRun', 'onOpen', 'createMenu', 'automaticRepair']) {
    assert.equal(source.includes(forbidden), false, `forbidden token present: ${forbidden}`);
  }
});

test('D5E retention and security design markers are present in local contract', () => {
  const policy = fromVm(gas.exports.D5E_RETENTION_AND_SANITIZATION_POLICY_);
  assert.equal(policy.rawIdExclusion, true);
  assert.equal(policy.piiExclusion, true);
  assert.equal(policy.rawSourcePayloadPersisted, false);
  assert.equal(policy.maximumEventCountPerJob, 40);
});
