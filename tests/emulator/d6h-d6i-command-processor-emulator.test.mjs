import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['sgdsCommandQueue.js', 'sgdsCheckpointWorker.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['sgdsCommandQueue.js', 'sgdsCheckpointWorker.js'],
  exportNames: [
    'normalizeSgdsAuthorizedUser_',
    'createSgdsCommandRequest_',
    'createSgdsCommandProcessor_',
    'createFakeSgdsCommandRepository_',
    'createD6iClock_',
    'createFakeWorkerClock_',
    'createFakeWorkerLock_',
    'createFakeSgdsWorkerRepository_',
    'createSgdsCheckpointWorker_'
  ]
});

const fixtures = JSON.parse(fs.readFileSync('fixtures/d6h-d6i/ui-command-fixtures.json', 'utf8'));
const fromVm = value => JSON.parse(JSON.stringify(value));

function createCommand(commandType, jobId, actorName = 'operator', extra = {}) {
  return fromVm(gas.call('createSgdsCommandRequest_', {
    commandType,
    targetJobId: jobId,
    targetAttachmentId: extra.targetAttachmentId || '',
    reason: extra.reason || (commandType === 'ignore_job' ? 'safe ignore reason' : 'safe local reason')
  }, gas.call('normalizeSgdsAuthorizedUser_', fixtures.users[actorName]), { now: '2026-07-18T00:06:00.000Z' }));
}

function repositoryWith(command, jobs = fixtures.jobs) {
  const repo = gas.call('createFakeSgdsCommandRepository_', { jobs });
  repo.createCommand(command);
  return repo;
}

function processor(repository, options = {}) {
  return gas.call('createSgdsCommandProcessor_', {
    repository,
    clock: gas.call('createD6iClock_', '2026-07-18T00:07:00.000Z'),
    worker: options.worker || null
  });
}

test('metadata', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
});

test('valid retry command claimed once and repeated processor invocation is idempotent with zero production calls', () => {
  const command = createCommand('retry_job', 'job_retry_001');
  const repo = repositoryWith(command);
  const result = fromVm(processor(repo).runOnce({ limit: 1 }));
  assert.equal(result.processedCount, 1);
  assert.equal(result.results[0].status, 'completed');
  assert.equal(result.results[0].code, 'RETRY_REQUEUED');
  assert.equal(result.productionCallCount, 0);
  assert.equal(fromVm(repo.getJob('job_retry_001')).status, 'queued');
  assert.equal(fromVm(processor(repo).runOnce({ limit: 1 })).processedCount, 0);
});

test('duplicate command rejected or no-op, unsupported command rejected, and conflicting active command blocks', () => {
  const command = createCommand('retry_job', 'job_retry_001');
  const repo = repositoryWith(command);
  assert.equal(fromVm(repo.createCommand(command)).duplicate, true);
  repo.createCommand({ ...command, commandId: 'cmd_dup_002', idempotencyKey: 'cmdem_dup002' });
  const unsupported = { ...command, commandId: 'cmd_bad_001', idempotencyKey: 'cmdem_bad001', commandType: 'delete_source', status: 'requested' };
  repo.createCommand(unsupported);
  const result = fromVm(processor(repo).runOnce({ limit: 3 }));
  assert.equal(result.results[0].status, 'rejected');
  assert.equal(result.results[0].code, 'ACTIVE_DUPLICATE_COMMAND');
  assert.equal(result.results[2].code, 'COMMAND_TYPE_UNSUPPORTED');
  assert.equal(fromVm(repo.listCommandAudit()).some(event => event.eventType === 'command_rejected'), true);
});

test('target job missing, target job state ineligible, retry exhausted, and ignore requires reason', () => {
  const retryDone = createCommand('retry_job', 'job_done_001');
  const retryMissing = createCommand('retry_job', 'job_missing_001');
  const exhaustedJob = { ...fixtures.jobs[0], jobId: 'job_exhausted_001', attemptCount: 5, retryPolicy: { maxAttempts: 5 } };
  const retryExhausted = createCommand('retry_job', 'job_exhausted_001');
  const ignoreNoReason = { ...createCommand('ignore_job', 'job_retry_001', 'admin'), commandId: 'cmd_ignore_blank', idempotencyKey: 'cmdem_ignore0', reason: '' };
  const repo = gas.call('createFakeSgdsCommandRepository_', { jobs: fixtures.jobs.concat([exhaustedJob]) });
  [retryDone, retryMissing, retryExhausted, ignoreNoReason].forEach(command => repo.createCommand(command));
  const result = fromVm(processor(repo).runOnce({ limit: 4 }));
  assert.deepEqual(result.results.map(item => item.code), ['JOB_NOT_RETRYABLE', 'TARGET_JOB_MISSING', 'RETRY_EXHAUSTED', 'REASON_REQUIRED']);
});

test('ignore, reprocess attachment and reconciliation command simulate safely without live Workspace calls', () => {
  const ignore = createCommand('ignore_job', 'job_retry_001', 'admin', { reason: 'no longer needed' });
  const ignoreRepo = repositoryWith(ignore);
  assert.equal(fromVm(processor(ignoreRepo).runOnce({ limit: 1 })).results[0].code, 'JOB_IGNORED_LOCALLY');
  assert.equal(fromVm(ignoreRepo.getJob('job_retry_001')).status, 'ignored');

  const reprocess = createCommand('reprocess_attachment', 'job_retry_001', 'operator', { targetAttachmentId: 'att_xml_001', reason: 'safe reprocess' });
  const reprocessRepo = repositoryWith(reprocess);
  assert.equal(fromVm(processor(reprocessRepo).runOnce({ limit: 1 })).results[0].code, 'ATTACHMENT_REPROCESS_SIMULATED');
  assert.equal(fromVm(reprocessRepo.listCheckpoints('job_retry_001'))[0].name, 'attachment_reprocess_requested');

  const reconcile = createCommand('reconcile_job', 'job_retry_001');
  const reconcileRepo = repositoryWith(reconcile);
  assert.equal(fromVm(processor(reconcileRepo).runOnce({ limit: 1 })).results[0].code, 'RECONCILIATION_SIMULATED');
});

test('reprocess attachment missing attachment, command result redaction, command audit event, no live Apps Script execution', () => {
  const missingAttachment = createCommand('reprocess_attachment', 'job_retry_001', 'operator', { targetAttachmentId: 'att_missing_001', reason: 'Authorization bearer text' });
  const repo = repositoryWith(missingAttachment);
  const result = fromVm(processor(repo).runOnce({ limit: 1 }));
  assert.equal(result.results[0].code, 'ATTACHMENT_MISSING');
  const command = fromVm(repo.getCommand(missingAttachment.commandId));
  assert.equal(command.reason, 'REDACTED_SECRET');
  assert.equal(fromVm(repo.listCommandAudit()).length, 1);
  assert.equal(result.productionMutationCount, 0);
});
