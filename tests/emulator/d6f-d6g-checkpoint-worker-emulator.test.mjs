import test from 'node:test';
import assert from 'node:assert/strict';
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
    'createFakeWorkerClock_',
    'createFakeWorkerLock_',
    'createFakeSgdsWorkerRepository_',
    'createSgdsCheckpointWorker_',
    'createWorkerCheckpointManager_',
    'createWorkerLeaseManager_',
    'createWorkerRetryScheduler_',
    'SGDS_D6F_PRODUCTION_CALL_EVIDENCE_'
  ]
});

const fromVm = (value) => JSON.parse(JSON.stringify(value));

function harness(options = {}) {
  const clock = gas.call('createFakeWorkerClock_', '2026-07-18T00:00:00.000Z');
  const repository = gas.call('createFakeSgdsWorkerRepository_', { clock });
  const jobs = options.jobs || [{ jobId: 'emu-job-001', gmailMessageId: 'emu-msg-001', threadId: 'emu-thread-001', attachmentIds: ['emu-att-001'] }];
  const worker = gas.call('createSgdsCheckpointWorker_', {
    config: { simulatedExecution: true, ...(options.config || {}) },
    clock,
    repository,
    globalLock: options.globalLock || gas.call('createFakeWorkerLock_', options.lockOptions || {}),
    discovery: { discover: () => jobs },
    drivePlanner: { plan: job => ({ status: 'simulated_drive', jobId: job.jobId }) },
    sheetsPlanner: { plan: job => ({ status: 'simulated_sheet', jobId: job.jobId }) },
    failureInjection: options.failureInjection || {}
  });
  return { clock, repository, worker };
}

test('metadata', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(gas.exports.SGDS_D6F_PRODUCTION_CALL_EVIDENCE_, 'ZERO_PRODUCTION_CALLS');
});

test('D6F emulator scenario 1-5: create, queue, lease, checkpoint, complete simulated job', async () => {
  const { repository, worker } = harness();
  const summary = fromVm(await worker.run({ invocationSource: 'manual_local_test', correlationId: 'corr-emu' }));
  assert.equal(summary.discoveredCount, 1);
  assert.equal(summary.attemptedJobCount, 1);
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.productionCallCount, 0);
  const job = fromVm(repository.getJob('emu-job-001'));
  assert.equal(job.status, 'completed');
  const checkpointNames = fromVm(repository.listCheckpoints('emu-job-001')).map(item => item.name);
  assert.deepEqual(checkpointNames, [
    'discovery_recorded',
    'lease_acquired',
    'message_normalized',
    'attachment_planned',
    'attachment_saved',
    'business_data_normalized',
    'sheet_upsert_planned',
    'sheet_written',
    'reconciliation_recorded',
    'completed'
  ]);
  assert.equal(fromVm(repository.getReconciliation('emu-job-001')).state, 'fully_reconciled');
  assert.equal(fromVm(repository.listAudit('emu-job-001')).length > 0, true);
});

test('D6F emulator scenario 6-7 and 12: resume after injected stage failures and preserve idempotency', async () => {
  const attachmentFailure = harness({ failureInjection: { stage: 'attachment_planned', code: 'retryable_transport_error' } });
  const failed = fromVm(await attachmentFailure.worker.run({ invocationSource: 'manual_local_test' }));
  assert.equal(failed.retryableFailureCount, 1);
  assert.equal(fromVm(attachmentFailure.repository.getJob('emu-job-001')).status, 'failed_retryable');
  attachmentFailure.clock.advanceSeconds(121);
  const resumedWorker = gas.call('createSgdsCheckpointWorker_', {
    config: { simulatedExecution: true },
    clock: attachmentFailure.clock,
    repository: attachmentFailure.repository,
    globalLock: gas.call('createFakeWorkerLock_', {}),
    discovery: { discover: () => [] },
    drivePlanner: { plan: job => ({ status: 'simulated_drive', jobId: job.jobId }) },
    sheetsPlanner: { plan: job => ({ status: 'simulated_sheet', jobId: job.jobId }) }
  });
  const resumed = fromVm(await resumedWorker.run({ invocationSource: 'retry_command' }));
  assert.equal(resumed.completedCount, 1);
  assert.equal(fromVm(attachmentFailure.repository.getJob('emu-job-001')).status, 'completed');

  const replay = fromVm(await resumedWorker.run({ invocationSource: 'manual_local_test' }));
  assert.equal(replay.noOpCount, 1);

  const sheetFailure = harness({ jobs: [{ jobId: 'emu-job-002' }], failureInjection: { stage: 'sheet_upsert_planned', code: 'retryable_timeout' } });
  assert.equal(fromVm(await sheetFailure.worker.run({ invocationSource: 'manual_local_test' })).retryableFailureCount, 1);
});

test('D6F emulator scenario 8-11: lease conflict, expired lease reclaim, retry eligibility, retry exhaustion', async () => {
  const conflict = harness({ jobs: [] });
  conflict.repository.createOrRecoverJobs([{ jobId: 'emu-job-lease' }], { correlationId: 'corr-pre', startedAt: conflict.clock.now() });
  const leases = gas.call('createWorkerLeaseManager_', conflict.repository, {}, conflict.clock);
  leases.acquire('emu-job-lease', 'other-worker');
  const conflictSummary = fromVm(await conflict.worker.run({ invocationSource: 'manual_local_test', workerInstanceId: 'worker-local-001' }));
  assert.equal(conflictSummary.skippedLeaseCount, 1);

  conflict.clock.advanceSeconds(361);
  const reclaimSummary = fromVm(await conflict.worker.run({ invocationSource: 'manual_local_test', workerInstanceId: 'worker-local-001' }));
  assert.equal(reclaimSummary.completedCount, 1);

  const retryNotDue = harness({ jobs: [{ jobId: 'emu-job-retry-not-due', status: 'failed_retryable', nextRetryAt: '2026-07-18T01:00:00.000Z' }] });
  assert.equal(fromVm(await retryNotDue.worker.run({ invocationSource: 'manual_local_test' })).skippedRetryNotDueCount, 1);

  const exhausted = harness({ jobs: [{ jobId: 'emu-job-exhausted', attemptCount: 4 }], failureInjection: { stage: 'attachment_planned', code: 'retryable_rate_limit' } });
  assert.equal(fromVm(await exhausted.worker.run({ invocationSource: 'manual_local_test' })).terminalFailureCount, 1);
  assert.equal(fromVm(exhausted.repository.getJob('emu-job-exhausted')).status, 'failed_terminal');
});

test('D6F emulator scenario 13-20: invalid checkpoint, audit, reconciliation, budget, batch, lock skip, zero production calls, controlled failure consistency', async () => {
  const invalid = harness({ jobs: [] });
  invalid.repository.createOrRecoverJobs([{ jobId: 'emu-job-invalid' }], { correlationId: 'corr-pre', startedAt: invalid.clock.now() });
  invalid.repository.addCheckpoint('emu-job-invalid', { checkpointId: 'bad-1', jobId: 'emu-job-invalid', name: 'sheet_written' });
  invalid.repository.addCheckpoint('emu-job-invalid', { checkpointId: 'bad-2', jobId: 'emu-job-invalid', name: 'message_normalized' });
  const manager = gas.call('createWorkerCheckpointManager_', invalid.repository);
  assert.equal(fromVm(manager.verify(invalid.repository.getJob('emu-job-invalid'))).status, 'invalid_checkpoint_sequence');
  assert.equal(fromVm(await invalid.worker.run({ invocationSource: 'manual_local_test' })).terminalFailureCount, 1);

  const budget = harness({ jobs: [{ jobId: 'emu-budget-1' }, { jobId: 'emu-budget-2' }], config: { maxJobsPerRun: 1 } });
  assert.equal(fromVm(await budget.worker.run({ invocationSource: 'manual_local_test' })).stoppedReason, 'batch_limit_reached');

  const lock = harness({ lockOptions: { failAcquire: true } });
  assert.equal(fromVm(await lock.worker.run({ invocationSource: 'manual_local_test' })).stoppedReason, 'lock_not_acquired');

  const controlled = harness({ failureInjection: { stage: 'message_normalized', code: 'terminal_validation_error' } });
  const controlledSummary = fromVm(await controlled.worker.run({ invocationSource: 'manual_local_test' }));
  assert.equal(controlledSummary.terminalFailureCount, 1);
  assert.equal(controlledSummary.productionCallCount, 0);
  assert.equal(controlledSummary.productionMutationCount, 0);
  assert.equal(fromVm(controlled.repository.listAudit('emu-job-001')).some(event => event.eventType === 'JOB_TRANSITION_ACCEPTED'), true);
});
