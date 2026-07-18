import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const requiredFiles = [
  'sgdsCheckpointWorker.js',
  'sgdsTriggerGuards.js',
  'fixtures/d6f-d6g/worker-trigger-fixtures.json',
  'tests/unit/d6f-d6g-checkpoint-worker-trigger-guards.test.mjs',
  'tests/emulator/d6f-d6g-checkpoint-worker-emulator.test.mjs',
  'docs/phases/D6F_D6G_CHECKPOINT_WORKER_TRIGGER_GUARDS.md',
  'docs/evidence/D6F_D6G_LOCAL_WORKER_TRIGGER_EVIDENCE.md'
];

for (const file of requiredFiles) assert.equal(exists(file), true, `missing D6F-D6G file: ${file}`);

const worker = read('sgdsCheckpointWorker.js');
const triggers = read('sgdsTriggerGuards.js');
const unitTests = read('tests/unit/d6f-d6g-checkpoint-worker-trigger-guards.test.mjs');
const emulatorTests = read('tests/emulator/d6f-d6g-checkpoint-worker-emulator.test.mjs');
const fixtures = JSON.parse(read('fixtures/d6f-d6g/worker-trigger-fixtures.json'));
const phaseDoc = read('docs/phases/D6F_D6G_CHECKPOINT_WORKER_TRIGGER_GUARDS.md');
const evidenceDoc = read('docs/evidence/D6F_D6G_LOCAL_WORKER_TRIGGER_EVIDENCE.md');
const pkg = JSON.parse(read('package.json'));

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
  'manual_local_test',
  'manual_apps_script',
  'scheduled_trigger',
  'retry_command',
  'reconciliation_command',
  'discovery_recorded',
  'job_queued',
  'lease_acquired',
  'message_normalized',
  'attachment_planned',
  'attachment_saved',
  'business_data_normalized',
  'sheet_upsert_planned',
  'sheet_written',
  'reconciliation_recorded',
  'completed',
  'retryable_transport_error',
  'retryable_rate_limit',
  'retryable_timeout',
  'terminal_permission_error',
  'runtime_budget_exhausted',
  'worker_lock_not_acquired',
  'fully_reconciled',
  'partially_reconciled_resumable',
  'invalid_checkpoint_sequence',
  'ZERO_PRODUCTION_CALLS',
  'dryRun: true',
  'environment: \'local\'',
  'maxMessagesPerRun: 10',
  'maxJobsPerRun: 10',
  'maxAttachmentsPerRun: 10',
  'maxRetriesPerJob: 5',
  'leaseDurationSeconds: 360',
  'maximumConsecutiveFailures: 3',
  'productionCallCount: 0',
  'productionMutationCount: 0'
]) assert.equal(worker.includes(marker), true, `worker missing ${marker}`);

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
  'TriggerDryRunPlanner',
  'TRIGGER_MUTATION_BLOCKED_PHASE_NOT_AUTHORIZED',
  'handlerFunction: \'runSgdsWorkerDryRun\'',
  'intervalMinutes: 10',
  'ownerApprovalRequired: true',
  'liveMutationAllowed: false',
  'genericForceAccepted: false'
]) assert.equal(triggers.includes(marker), true, `trigger guards missing ${marker}`);

for (const forbidden of [
  'GmailApp.',
  'DriveApp.',
  'SpreadsheetApp.',
  'UrlFetchApp.',
  'LockService.',
  'PropertiesService.',
  'ScriptApp.newTrigger',
  'ScriptApp.deleteTrigger',
  'firestore.googleapis.com',
  'firebase deploy',
  'clasp push',
  'gcloud services enable',
  'gcloud run deploy',
  'force === true &&',
  'dryRun: false',
  'environment: \'production\'',
  'productionMutationCount: 1',
  'productionCallCount: 1'
]) {
  assert.equal(worker.includes(forbidden), false, `worker contains forbidden marker: ${forbidden}`);
  assert.equal(triggers.includes(forbidden), false, `trigger guards contain forbidden marker: ${forbidden}`);
}

for (const marker of [
  'worker coordination handles empty queue, success, multiple bounded jobs',
  'checkpoint manager records, resumes, rejects backward sequence',
  'lease manager acquires, renews, releases',
  'error classification and retry scheduler bound retry',
  'runtime soft deadline, batch limit, consecutive failure guard',
  'dry-run planning mode never emits completed production-style evidence',
  'trigger policy, inspection, duplicate detection',
  'quota guard validates conservative config',
  'security and static safety'
]) assert.equal(unitTests.includes(marker), true, `unit tests missing ${marker}`);

for (const marker of [
  'create, queue, lease, checkpoint, complete simulated job',
  'resume after injected stage failures',
  'lease conflict, expired lease reclaim',
  'invalid checkpoint, audit, reconciliation, budget, batch, lock skip'
]) assert.equal(emulatorTests.includes(marker), true, `emulator tests missing ${marker}`);

assert.equal(fixtures.fixturePolicy.realEmailContent, false, 'fixtures must be synthetic');
assert.equal(fixtures.fixturePolicy.credentials, false, 'fixtures must not contain credentials');
assert.equal(fixtures.fixturePolicy.productionFirestore, false, 'fixtures must not use production Firestore');
assert.equal(fixtures.fixturePolicy.liveTriggers, false, 'fixtures must not use live triggers');
assert.equal(fixtures.cases.length >= 20, true, 'fixture catalogue must include at least 20 cases');

for (const id of [
  'no_work',
  'one_valid_invoice_job',
  'two_bounded_jobs',
  'attachment_stage_transient_failure',
  'sheet_stage_transient_failure',
  'terminal_validation_failure',
  'terminal_permission_failure',
  'expired_lease_recovery',
  'active_lease_conflict',
  'retry_not_due',
  'retry_due',
  'retry_exhausted',
  'completed_duplicate_job',
  'conflicting_source_hash',
  'invalid_checkpoint_sequence',
  'runtime_deadline_reached',
  'trigger_missing',
  'exactly_one_valid_trigger',
  'duplicate_trigger',
  'unrelated_trigger'
]) assert.equal(fixtures.cases.some(item => item.id === id), true, `fixture missing ${id}`);

for (const marker of [
  'PHASE=D6F_D6G_CHECKPOINT_WORKER_TRIGGER_GUARDS',
  'STATUS=PASS_LOCAL_IMPLEMENTATION_VALIDATED',
  'CHECKPOINT_WORKER=IMPLEMENTED_LOCAL_ONLY',
  'TRIGGER_LIVE_MUTATION_ALLOWED=NO',
  'DEFAULT_DRY_RUN=true',
  'PRODUCTION_MODE_DEFAULT=NON_PRODUCTION',
  'PRODUCTION_CALL_EVIDENCE=ZERO_PRODUCTION_CALLS',
  'NEXT_ALLOWED_PHASE=D6H_D6I_FIREBASE_UI_COMMAND_QUEUE'
]) {
  assert.equal(phaseDoc.includes(marker), true, `phase doc missing ${marker}`);
  assert.equal(evidenceDoc.includes(marker), true, `evidence doc missing ${marker}`);
}

assert.equal(pkg.scripts['check:d6f-d6g-checkpoint-worker-trigger-guards'], 'node scripts/checkers/check-d6f-d6g-checkpoint-worker-trigger-guards.mjs');

console.log('D6F_D6G_CHECKPOINT_WORKER_TRIGGER_GUARDS_CHECK=PASS');
