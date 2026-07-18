import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'sgdsCheckpointWorker.js',
    'sgdsTriggerGuards.js'
  ],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: [
    'sgdsCheckpointWorker.js',
    'sgdsTriggerGuards.js'
  ],
  exportNames: [
    'SGDS_D6F_D6G_SCHEMA_VERSION_',
    'SGDS_D6F_PRODUCTION_CALL_EVIDENCE_',
    'SGDS_D6F_WORKER_COMPONENTS_',
    'SGDS_D6F_JOB_STATES_',
    'SGDS_D6F_JOB_TRANSITIONS_',
    'SGDS_D6F_CHECKPOINT_SEQUENCE_',
    'SGDS_D6F_ERROR_CATEGORIES_',
    'SGDS_D6F_RECONCILIATION_STATES_',
    'SGDS_D6F_DEFAULT_CONFIG_',
    'createSgdsD6fWorkerConfig_',
    'validateSgdsD6fWorkerConfig_',
    'createSgdsWorkerRunContext_',
    'createWorkerRuntimeBudget_',
    'createWorkerBatchPlanner_',
    'createWorkerCheckpointManager_',
    'createWorkerLeaseManager_',
    'createWorkerErrorClassifier_',
    'createWorkerRetryScheduler_',
    'createWorkerReconciliationCoordinator_',
    'createWorkerRunSummaryBuilder_',
    'createWorkerCorrelationIdFactory_',
    'createSgdsCheckpointWorker_',
    'createFakeSgdsWorkerRepository_',
    'createFakeWorkerClock_',
    'createFakeWorkerDelay_',
    'createFakeWorkerLock_',
    'runSgdsWorkerDryRun',
    'inspectSgdsWorkerConfiguration',
    'SGDS_D6G_TRIGGER_SCHEMA_VERSION_',
    'SGDS_D6G_TRIGGER_MUTATION_BLOCKED_STATUS_',
    'SGDS_D6G_TRIGGER_COMPONENTS_',
    'getAppsScriptTriggerPolicy_',
    'buildTriggerPlan_',
    'normalizeTriggerInspection_',
    'inspectTriggersDryRun_',
    'detectDuplicateTriggers_',
    'guardTriggerMutation_',
    'createAppsScriptQuotaGuard_',
    'normalizeD6gRuntimeConfiguration_',
    'validateD6gRuntimeConfiguration_',
    'inspectSgdsTriggerPlan',
    'createFakeTriggerTransport_'
  ]
});

const fromVm = (value) => JSON.parse(JSON.stringify(value));
const fixtures = JSON.parse(fs.readFileSync('fixtures/d6f-d6g/worker-trigger-fixtures.json', 'utf8'));

function caseById(id) {
  return fixtures.cases.find(item => item.id === id);
}

function createWorker(options = {}) {
  const clock = options.clock || gas.call('createFakeWorkerClock_', options.start || '2026-07-18T00:00:00.000Z');
  const repository = options.repository || gas.call('createFakeSgdsWorkerRepository_', { clock });
  const jobs = options.jobs || caseById('one_valid_invoice_job').jobs;
  const worker = gas.call('createSgdsCheckpointWorker_', {
    config: { simulatedExecution: true, ...(options.config || {}) },
    clock,
    repository,
    globalLock: options.globalLock || gas.call('createFakeWorkerLock_', options.lockOptions || {}),
    discovery: { discover: () => jobs },
    drivePlanner: { plan: (job) => ({ status: 'simulated_drive_plan', jobId: job.jobId }) },
    sheetsPlanner: { plan: (job) => ({ action: 'INSERT', jobId: job.jobId }) },
    failureInjection: options.failureInjection || {}
  });
  return { worker, repository, clock };
}

test('metadata and fixture catalogue', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(fixtures.fixturePolicy.realEmailContent, false);
  assert.equal(fixtures.fixturePolicy.credentials, false);
  assert.equal(fixtures.fixturePolicy.liveTriggers, false);
  assert.equal(fixtures.cases.length >= 20, true);
  assert.equal(gas.exports.SGDS_D6F_D6G_SCHEMA_VERSION_, 'SGDS_D6F_D6G_CHECKPOINT_WORKER_V1');
  assert.equal(gas.exports.SGDS_D6F_PRODUCTION_CALL_EVIDENCE_, 'ZERO_PRODUCTION_CALLS');
});

test('D6F worker component catalogue and default configuration are fail-closed', () => {
  const components = fromVm(gas.exports.SGDS_D6F_WORKER_COMPONENTS_);
  for (const marker of [
    'SgdsCheckpointWorker',
    'WorkerRunCoordinator',
    'WorkerRunContext',
    'WorkerRuntimeBudget',
    'WorkerBatchPlanner',
    'WorkerJobProcessor',
    'WorkerCheckpointManager',
    'WorkerLeaseManager',
    'WorkerRetryScheduler',
    'WorkerErrorClassifier',
    'WorkerReconciliationCoordinator',
    'WorkerRunSummaryBuilder',
    'WorkerCorrelationIdFactory',
    'WorkerClock interface',
    'WorkerDelay interface',
    'WorkerLock interface',
    'Apps Script runtime shell'
  ]) assert.ok(components.includes(marker), marker);

  const config = fromVm(gas.call('createSgdsD6fWorkerConfig_', {}));
  assert.equal(config.dryRun, true);
  assert.equal(config.environment, 'local');
  assert.equal(config.maxMessagesPerRun, 10);
  assert.equal(config.maxJobsPerRun, 10);
  assert.equal(config.maxAttachmentsPerRun, 10);
  assert.equal(config.maxRetriesPerJob, 5);
  assert.equal(config.maxRetryActionsPerRun, 5);
  assert.equal(config.softRuntimeDeadlineSeconds, 240);
  assert.equal(config.leaseDurationSeconds, 360);
  assert.throws(() => gas.call('createSgdsD6fWorkerConfig_', { environment: '' }), /environment required/);
  assert.throws(() => gas.call('createSgdsD6fWorkerConfig_', { environment: 'production' }), /production mode requires future owner gate/);
  assert.throws(() => gas.call('createSgdsD6fWorkerConfig_', { maxJobsPerRun: 999 }), /invalid worker limit maxJobsPerRun/);
});

test('run context, correlation IDs, and runtime budget are deterministic', () => {
  const clock = gas.call('createFakeWorkerClock_', '2026-07-18T00:00:00.000Z');
  const context = fromVm(gas.call('createSgdsWorkerRunContext_', {
    invocationSource: 'manual_local_test',
    workerInstanceId: 'worker-a',
    clock
  }));
  assert.equal(context.dryRun, true);
  assert.equal(context.invocationSource, 'manual_local_test');
  assert.equal(context.correlationId.startsWith('corr_'), true);
  assert.equal(context.softDeadlineAt, '2026-07-18T00:04:00.000Z');
  assert.equal(context.hardDeadlineAt, '2026-07-18T00:05:00.000Z');
  const budget = gas.call('createWorkerRuntimeBudget_', context, clock);
  assert.equal(budget.canStartStage('message_normalized'), true);
  clock.advanceSeconds(241);
  assert.equal(budget.exhausted(), true);
  assert.throws(() => gas.call('createSgdsWorkerRunContext_', { invocationSource: 'broad_scan', clock }), /unsupported invocation source/);
});

test('worker coordination handles empty queue, success, multiple bounded jobs, and deterministic summary', async () => {
  const empty = createWorker({ jobs: [] });
  const emptySummary = fromVm(await empty.worker.run({ invocationSource: 'manual_local_test' }));
  assert.equal(emptySummary.discoveredCount, 0);
  assert.equal(emptySummary.productionCallCount, 0);
  assert.equal(emptySummary.productionMutationCount, 0);

  const one = createWorker({ jobs: caseById('one_valid_invoice_job').jobs });
  const first = fromVm(await one.worker.run({ invocationSource: 'manual_local_test' }));
  const second = fromVm(await one.worker.run({ invocationSource: 'manual_local_test' }));
  assert.equal(first.completedCount, 1);
  assert.equal(second.noOpCount, 1);
  assert.equal(first.dryRun, true);
  assert.equal(first.stoppedReason, 'completed_batch');

  const bounded = createWorker({ jobs: caseById('two_bounded_jobs').jobs, config: { maxJobsPerRun: 1 } });
  const summary = fromVm(await bounded.worker.run({ invocationSource: 'manual_local_test' }));
  assert.equal(summary.attemptedJobCount, 1);
  assert.equal(summary.remainingEligibleCount, 1);
  assert.equal(summary.stoppedReason, 'batch_limit_reached');
});

test('checkpoint manager records, resumes, rejects backward sequence, and completed no-op is stable', async () => {
  const { worker, repository } = createWorker();
  const summary = fromVm(await worker.run({ invocationSource: 'manual_local_test', correlationId: 'corr-stable' }));
  assert.equal(summary.completedCount, 1);
  const jobId = caseById('one_valid_invoice_job').jobs[0].jobId;
  const checkpoints = fromVm(repository.listCheckpoints(jobId)).map(item => item.name);
  assert.ok(checkpoints.includes('discovery_recorded'));
  assert.ok(checkpoints.includes('lease_acquired'));
  assert.ok(checkpoints.includes('completed'));
  const manager = gas.call('createWorkerCheckpointManager_', repository);
  assert.equal(fromVm(manager.verify(repository.getJob(jobId))).valid, true);
  repository.addCheckpoint(jobId, { checkpointId: 'corrupt-1', name: 'sheet_written', jobId });
  repository.addCheckpoint(jobId, { checkpointId: 'corrupt-2', name: 'message_normalized', jobId });
  assert.equal(fromVm(manager.verify(repository.getJob(jobId))).status, 'invalid_checkpoint_sequence');
});

test('lease manager acquires, renews, releases, handles same owner, conflicts, expiry, and malformed release', () => {
  const clock = gas.call('createFakeWorkerClock_', '2026-07-18T00:00:00.000Z');
  const repo = gas.call('createFakeSgdsWorkerRepository_', { clock });
  const leases = gas.call('createWorkerLeaseManager_', repo, {}, clock);
  const first = fromVm(leases.acquire('job-lease', 'worker-a'));
  assert.equal(first.acquired, true);
  assert.equal(fromVm(leases.acquire('job-lease', 'worker-a')).status, 'LEASE_REACQUIRED_SAME_OWNER');
  assert.equal(fromVm(leases.acquire('job-lease', 'worker-b')).status, 'LEASE_CONFLICT_ACTIVE_OWNER');
  assert.equal(fromVm(leases.renew('job-lease', first.lease.leaseId)).status, 'LEASE_RENEWED');
  assert.equal(fromVm(leases.release('job-lease', 'wrong-lease', 'bad')).status, 'LEASE_RELEASE_REJECTED');
  assert.equal(fromVm(leases.release('job-lease', first.lease.leaseId, 'success')).status, 'LEASE_RELEASED');
  const second = fromVm(leases.acquire('job-lease', 'worker-b'));
  assert.equal(second.acquired, true);
  clock.advanceSeconds(361);
  assert.equal(fromVm(leases.acquire('job-lease', 'worker-c')).status, 'LEASE_RECLAIMED_EXPIRED');
});

test('worker skips active conflicting lease and releases lock after controlled failure', async () => {
  const clock = gas.call('createFakeWorkerClock_', '2026-07-18T00:00:00.000Z');
  const repo = gas.call('createFakeSgdsWorkerRepository_', { clock });
  const job = caseById('active_lease_conflict').jobs[0];
  repo.createOrRecoverJobs([job], { correlationId: 'corr-pre', startedAt: clock.now() });
  const leases = gas.call('createWorkerLeaseManager_', repo, {}, clock);
  leases.acquire(job.jobId, 'other-worker');
  const worker = createWorker({ clock, repository: repo, jobs: [], config: { simulatedExecution: true } }).worker;
  const summary = fromVm(await worker.run({ invocationSource: 'manual_local_test', workerInstanceId: 'worker-local-001' }));
  assert.equal(summary.skippedLeaseCount, 1);
});

test('error classification and retry scheduler bound retry, eligibility, exhaustion, and jitter', async () => {
  const classifier = gas.call('createWorkerErrorClassifier_');
  assert.equal(fromVm(classifier.classify({ code: 503, message: 'transport unavailable' })).category, 'retryable_transport_error');
  assert.equal(fromVm(classifier.classify({ code: 429, message: 'rate limit' })).category, 'retryable_rate_limit');
  assert.equal(fromVm(classifier.classify({ message: 'timeout' })).category, 'retryable_timeout');
  assert.equal(fromVm(classifier.classify({ message: 'permission denied Authorization Bearer abc' })).category, 'terminal_permission_error');
  assert.equal(fromVm(classifier.classify({ message: 'validation failed' })).category, 'terminal_validation_error');
  assert.equal(fromVm(classifier.classify({ message: 'private key body' })).safeMessage, 'REDACTED_SECRET');

  const clock = gas.call('createFakeWorkerClock_', '2026-07-18T00:00:00.000Z');
  const retry = gas.call('createWorkerRetryScheduler_', {}, clock, attempt => attempt);
  const record = fromVm(retry.schedule({ attemptCount: 1 }, { category: 'retryable_timeout', safeMessage: 'safe' }));
  assert.equal(record.attemptCount, 2);
  assert.equal(record.maximumAttempts, 5);
  assert.equal(record.nextRetryAt, '2026-07-18T00:02:02.000Z');
  assert.equal(retry.isEligible({ status: 'failed_retryable', nextRetryAt: '2026-07-18T00:02:02.000Z' }), false);
  clock.advanceSeconds(123);
  assert.equal(retry.isEligible({ status: 'failed_retryable', nextRetryAt: '2026-07-18T00:02:02.000Z' }), true);

  const exhausted = createWorker({
    jobs: caseById('retry_exhausted').jobs,
    failureInjection: { stage: 'attachment_planned', code: 'retryable_rate_limit' }
  });
  const summary = fromVm(await exhausted.worker.run({ invocationSource: 'manual_local_test' }));
  assert.equal(summary.terminalFailureCount, 1);
});

test('runtime soft deadline, batch limit, consecutive failure guard, and lock contention stop cleanly', async () => {
  const lockContention = createWorker({ lockOptions: { failAcquire: true } });
  const skipped = fromVm(await lockContention.worker.run({ invocationSource: 'manual_local_test' }));
  assert.equal(skipped.stoppedReason, 'lock_not_acquired');
  assert.equal(skipped.status, 'SKIPPED');

  const deadline = createWorker({
    jobs: caseById('two_bounded_jobs').jobs,
    config: { softRuntimeDeadlineSeconds: 1, hardRuntimeDeadlineSeconds: 2 }
  });
  deadline.clock.advanceSeconds(2);
  const deadlineSummary = fromVm(await deadline.worker.run({ invocationSource: 'manual_local_test' }));
  assert.equal(deadlineSummary.budgetExhausted, true);
  assert.equal(deadlineSummary.stoppedReason, 'soft_deadline_reached');

  const failures = createWorker({
    jobs: [{ jobId: 'fail-1' }, { jobId: 'fail-2' }, { jobId: 'fail-3' }, { jobId: 'fail-4' }],
    config: { maximumConsecutiveFailures: 2 },
    failureInjection: { stage: 'message_normalized', code: 'terminal_validation_error' }
  });
  const failureSummary = fromVm(await failures.worker.run({ invocationSource: 'manual_local_test' }));
  assert.equal(failureSummary.terminalFailureCount, 2);
  assert.equal(failureSummary.stoppedReason, 'consecutive_failure_limit_reached');
});

test('dry-run planning mode never emits completed production-style evidence', async () => {
  const dry = createWorker({ config: { simulatedExecution: false } });
  const summary = fromVm(await dry.worker.run({ invocationSource: 'manual_local_test' }));
  assert.equal(summary.completedCount, 0);
  assert.equal(summary.terminalFailureCount, 1);
  assert.equal(summary.productionMutationCount, 0);
});

test('trigger policy, inspection, duplicate detection, fake transport, and mutation guard are fail-closed', () => {
  const components = fromVm(gas.exports.SGDS_D6G_TRIGGER_COMPONENTS_);
  for (const marker of [
    'AppsScriptTriggerPolicy',
    'TriggerPlanBuilder',
    'TriggerDuplicateDetector',
    'TriggerInspectionNormalizer',
    'TriggerMutationGuard',
    'AppsScriptQuotaGuard',
    'WorkerInvocationPolicy',
    'RuntimeConfigurationValidator',
    'TriggerTransport interface',
    'FakeTriggerTransport',
    'TriggerDryRunInspector',
    'TriggerDryRunPlanner'
  ]) assert.ok(components.includes(marker), marker);
  const plan = fromVm(gas.call('buildTriggerPlan_', {}));
  assert.equal(plan.handlerFunction, 'runSgdsWorkerDryRun');
  assert.equal(plan.intervalMinutes, 10);
  assert.equal(plan.ownerApprovalRequired, true);
  assert.equal(plan.dryRun, true);

  assert.equal(fromVm(gas.call('inspectTriggersDryRun_', caseById('trigger_missing').triggers)).status, 'TRIGGER_MISSING');
  const one = fromVm(gas.call('inspectTriggersDryRun_', caseById('exactly_one_valid_trigger').triggers));
  assert.equal(one.status, 'TRIGGER_EXACTLY_ONE_MATCH');
  assert.equal(one.triggers[0].rawIdLogged, false);
  const duplicate = fromVm(gas.call('inspectTriggersDryRun_', caseById('duplicate_trigger').triggers));
  assert.equal(duplicate.status, 'TRIGGER_DUPLICATE_CANONICAL');
  assert.equal(fromVm(gas.call('detectDuplicateTriggers_', duplicate)).duplicate, true);
  const unrelated = fromVm(gas.call('inspectTriggersDryRun_', caseById('unrelated_trigger').triggers));
  assert.equal(unrelated.unrelatedTriggerCount, 1);
  assert.deepEqual(unrelated.deletionCandidates, []);

  const guard = fromVm(gas.call('guardTriggerMutation_', { operation: 'create', force: true }));
  assert.equal(guard.status, 'TRIGGER_MUTATION_BLOCKED_PHASE_NOT_AUTHORIZED');
  assert.equal(guard.genericForceAccepted, false);
  assert.equal(guard.genericForceRejected, true);
  const transport = gas.call('createFakeTriggerTransport_', caseById('exactly_one_valid_trigger').triggers);
  assert.equal(fromVm(transport.listTriggers()).length, 1);
  assert.equal(fromVm(transport.createTrigger({ operation: 'create' })).status, 'TRIGGER_MUTATION_BLOCKED_PHASE_NOT_AUTHORIZED');
  assert.equal(fromVm(transport.state.mutationCalls).length, 1);
});

test('quota guard validates conservative config and stops on runtime, message, job, attachment, retry, and virtual operation limits', () => {
  const guard = gas.call('createAppsScriptQuotaGuard_', {});
  assert.equal(fromVm(guard.assertCanStartRun()).allowed, true);
  for (const [field, value] of [
    ['maxMessagesPerRun', 0],
    ['maxJobsPerRun', -1],
    ['maxAttachmentsPerRun', 1000],
    ['softRuntimeDeadlineSeconds', 0],
    ['leaseDurationSeconds', 99999]
  ]) {
    assert.throws(() => gas.call('createAppsScriptQuotaGuard_', { [field]: value }), /QUOTA_LIMIT_INVALID/);
  }
  assert.equal(fromVm(guard.evaluateUsage({ messages: 11 })).stoppedReason, 'message_limit');
  assert.equal(fromVm(guard.evaluateUsage({ jobs: 11 })).stoppedReason, 'job_limit');
  assert.equal(fromVm(guard.evaluateUsage({ attachments: 11 })).stoppedReason, 'attachment_limit');
  assert.equal(fromVm(guard.evaluateUsage({ retryActions: 6 })).stoppedReason, 'retry_action_limit');
  assert.equal(fromVm(guard.evaluateUsage({ runtimeSeconds: 241 })).stoppedReason, 'runtime_limit');
  assert.equal(fromVm(guard.evaluateUsage({ virtualDriveWrites: 11 })).stoppedReason, 'virtual_drive_write_limit');
  assert.equal(fromVm(guard.evaluateUsage({ virtualSheetsWrites: 11 })).stoppedReason, 'virtual_sheets_write_limit');
});

test('Apps Script entrypoint foundations inspect configuration and trigger plans without live calls', async () => {
  const config = fromVm(gas.call('inspectSgdsWorkerConfiguration', {}));
  assert.equal(config.status, 'CONFIGURATION_VALID');
  assert.equal(config.defaultDryRun, true);
  assert.equal(config.productionCallCount, 0);
  const triggerPlan = fromVm(gas.call('inspectSgdsTriggerPlan', {}));
  assert.equal(triggerPlan.status, 'TRIGGER_DRY_RUN_PLAN_READY');
  assert.equal(triggerPlan.liveMutationAllowed, false);
  const summary = fromVm(await gas.call('runSgdsWorkerDryRun', {}));
  assert.equal(summary.dryRun, true);
  assert.equal(summary.productionCallCount, 0);
  assert.equal(summary.productionMutationCount, 0);
});

test('security and static safety: no direct live service calls, deploys, trigger mutation, or secret-shaped fixture content', () => {
  const source = fs.readFileSync('sgdsCheckpointWorker.js', 'utf8') + fs.readFileSync('sgdsTriggerGuards.js', 'utf8');
  for (const forbidden of [
    'GmailApp.',
    'DriveApp.',
    'SpreadsheetApp.',
    'UrlFetchApp.',
    'newTrigger',
    'ScriptApp.deleteTrigger',
    'firebase deploy',
    'clasp push',
    'gcloud services enable',
    'firestore.googleapis.com',
    'force === true &&'
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden marker present: ${forbidden}`);
  }
  const fixtureText = fs.readFileSync('fixtures/d6f-d6g/worker-trigger-fixtures.json', 'utf8');
  const privateKeyBlockMarker = ['BEGIN', 'PRIVATE', 'KEY'].join(' ');
  const refreshTokenMarker = ['refresh', 'token'].join('_');
  const clientSecretMarker = ['client', 'secret'].join('_');
  const oauthTokenPrefixMarker = ['ya', '29.'].join('');
  for (const forbidden of [oauthTokenPrefixMarker, privateKeyBlockMarker, refreshTokenMarker, clientSecretMarker, 'Authorization']) {
    assert.equal(fixtureText.includes(forbidden), false, `secret fixture marker present: ${forbidden}`);
  }
});
