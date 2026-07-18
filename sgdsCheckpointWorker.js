const SGDS_D6F_D6G_SCHEMA_VERSION_ = 'SGDS_D6F_D6G_CHECKPOINT_WORKER_V1';
const SGDS_D6F_PRODUCTION_CALL_EVIDENCE_ = 'ZERO_PRODUCTION_CALLS';

const SGDS_D6F_WORKER_COMPONENTS_ = Object.freeze([
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
  'FakeWorkerClock',
  'FakeWorkerDelay',
  'FakeWorkerLock',
  'Apps Script runtime shell'
]);

const SGDS_D6F_JOB_STATES_ = Object.freeze([
  'discovered',
  'queued',
  'processing',
  'attachment_saved',
  'data_extracted',
  'sheet_written',
  'completed',
  'failed_retryable',
  'failed_terminal',
  'ignored'
]);

const SGDS_D6F_TERMINAL_STATES_ = Object.freeze(['completed', 'failed_terminal', 'ignored']);

const SGDS_D6F_JOB_TRANSITIONS_ = Object.freeze({
  discovered: Object.freeze(['queued', 'failed_retryable', 'failed_terminal']),
  queued: Object.freeze(['processing', 'failed_retryable', 'failed_terminal']),
  processing: Object.freeze(['attachment_saved', 'failed_retryable', 'failed_terminal']),
  attachment_saved: Object.freeze(['data_extracted', 'failed_retryable', 'failed_terminal']),
  data_extracted: Object.freeze(['sheet_written', 'failed_retryable', 'failed_terminal']),
  sheet_written: Object.freeze(['completed', 'failed_retryable', 'failed_terminal']),
  completed: Object.freeze([]),
  failed_retryable: Object.freeze(['queued', 'processing', 'failed_terminal']),
  failed_terminal: Object.freeze([]),
  ignored: Object.freeze([])
});

const SGDS_D6F_CHECKPOINT_SEQUENCE_ = Object.freeze([
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
  'completed'
]);

const SGDS_D6F_ERROR_CATEGORIES_ = Object.freeze([
  'retryable_transport_error',
  'retryable_rate_limit',
  'retryable_timeout',
  'retryable_contention',
  'terminal_authentication_error',
  'terminal_permission_error',
  'terminal_validation_error',
  'terminal_schema_error',
  'terminal_unsupported_type',
  'idempotency_conflict',
  'reconciliation_conflict',
  'runtime_budget_exhausted',
  'worker_lock_not_acquired',
  'unknown_internal_error'
]);

const SGDS_D6F_RECONCILIATION_STATES_ = Object.freeze([
  'fully_reconciled',
  'partially_reconciled_resumable',
  'duplicate_source_no_op',
  'missing_drive_reference',
  'missing_sheet_reference',
  'conflicting_source_hash',
  'conflicting_business_key',
  'invalid_checkpoint_sequence',
  'requires_review',
  'terminal_inconsistent_state'
]);

const SGDS_D6F_DEFAULT_CONFIG_ = Object.freeze({
  runtimeMode: 'local',
  dryRun: true,
  simulatedExecution: false,
  environment: 'local',
  timezone: 'Asia/Ho_Chi_Minh',
  maxMessagesPerRun: 10,
  maxJobsPerRun: 10,
  maxAttachmentsPerRun: 10,
  maxRetriesPerJob: 5,
  maxRetryActionsPerRun: 5,
  softRuntimeDeadlineSeconds: 240,
  hardRuntimeDeadlineSeconds: 300,
  leaseDurationSeconds: 360,
  maximumConsecutiveFailures: 3,
  supportedMimeTypes: Object.freeze(['application/xml', 'application/pdf']),
  maximumAttachmentBytes: 5000000,
  maximumAuditEventsPerJob: 50,
  maximumFirestoreOperationsPerRun: 200,
  maximumVirtualDriveWritesPerRun: 10,
  maximumVirtualSheetsWritesPerRun: 10,
  canonicalTriggerHandler: 'runSgdsWorkerDryRun',
  schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_
});

function createSgdsD6fWorkerConfig_(overrides) {
  const source = overrides || {};
  const config = {
    ...SGDS_D6F_DEFAULT_CONFIG_,
    ...cloneD6fJson_(source),
    dryRun: source.dryRun === false ? false : true,
    schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_
  };
  validateSgdsD6fWorkerConfig_(config);
  return Object.freeze(config);
}

function validateSgdsD6fWorkerConfig_(config) {
  const source = config || {};
  if (!source.environment) throw d6fError_('configuration_invalid', 'environment required');
  if (source.environment === 'production') throw d6fError_('configuration_invalid', 'production mode requires future owner gate');
  if (source.dryRun !== true) throw d6fError_('configuration_invalid', 'dryRun must default true in D6F-D6G');
  const bounded = [
    ['maxMessagesPerRun', 1, 50],
    ['maxJobsPerRun', 1, 50],
    ['maxAttachmentsPerRun', 1, 50],
    ['maxRetriesPerJob', 1, 10],
    ['maxRetryActionsPerRun', 1, 20],
    ['softRuntimeDeadlineSeconds', 1, 540],
    ['hardRuntimeDeadlineSeconds', 1, 600],
    ['leaseDurationSeconds', 1, 900],
    ['maximumConsecutiveFailures', 1, 10],
    ['maximumAttachmentBytes', 1, 50000000],
    ['maximumAuditEventsPerJob', 1, 200],
    ['maximumFirestoreOperationsPerRun', 1, 1000],
    ['maximumVirtualDriveWritesPerRun', 0, 50],
    ['maximumVirtualSheetsWritesPerRun', 0, 50]
  ];
  bounded.forEach(([field, min, max]) => {
    const value = Number(source[field]);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw d6fError_('configuration_invalid', 'invalid worker limit ' + field);
    }
  });
  if (Number(source.softRuntimeDeadlineSeconds) >= Number(source.hardRuntimeDeadlineSeconds)) {
    throw d6fError_('configuration_invalid', 'soft deadline must be before hard deadline');
  }
  if (!Array.isArray(source.supportedMimeTypes) || !source.supportedMimeTypes.length) {
    throw d6fError_('configuration_invalid', 'supported MIME types required');
  }
  return true;
}

function createSgdsWorkerRunContext_(input, configInput) {
  const config = createSgdsD6fWorkerConfig_(configInput || {});
  const clock = (input && input.clock) || createFakeWorkerClock_();
  const startedAt = safeD6fString_((input && input.startedAt) || clock.now());
  const runId = safeD6fString_(input && input.runId) || 'run_' + d6fHashPrefix_(startedAt + ':' + (input && input.workerInstanceId || 'worker'));
  const correlationId = safeD6fString_(input && input.correlationId) || createWorkerCorrelationIdFactory_().create(runId);
  const invocationSource = safeD6fString_(input && input.invocationSource) || 'manual_local_test';
  if (!['manual_local_test', 'manual_apps_script', 'scheduled_trigger', 'retry_command', 'reconciliation_command'].includes(invocationSource)) {
    throw d6fError_('configuration_invalid', 'unsupported invocation source');
  }
  return Object.freeze({
    runId,
    correlationId,
    invocationSource,
    dryRun: config.dryRun,
    startedAt,
    softDeadlineAt: addD6fSeconds_(startedAt, config.softRuntimeDeadlineSeconds),
    hardDeadlineAt: addD6fSeconds_(startedAt, config.hardRuntimeDeadlineSeconds),
    maxJobs: config.maxJobsPerRun,
    maxMessages: config.maxMessagesPerRun,
    maxAttachments: config.maxAttachmentsPerRun,
    maxRetriesPerRun: config.maxRetryActionsPerRun,
    workerInstanceId: safeD6fString_(input && input.workerInstanceId) || 'worker-local-001',
    schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_
  });
}

function createWorkerCorrelationIdFactory_() {
  return Object.freeze({
    create(seed) {
      return 'corr_' + d6fHashPrefix_(seed || 'local');
    }
  });
}

function createWorkerRuntimeBudget_(context, clock) {
  const source = context || {};
  const workerClock = clock || createFakeWorkerClock_();
  return Object.freeze({
    remainingMillis() {
      return Math.max(0, Date.parse(source.softDeadlineAt) - Date.parse(workerClock.now()));
    },
    hardRemainingMillis() {
      return Math.max(0, Date.parse(source.hardDeadlineAt) - Date.parse(workerClock.now()));
    },
    canStartStage(stage) {
      const required = stage === 'lease_acquired' ? 1000 : 250;
      return this.remainingMillis() > required && this.hardRemainingMillis() > required;
    },
    exhausted() {
      return this.remainingMillis() <= 0 || this.hardRemainingMillis() <= 0;
    }
  });
}

function createWorkerBatchPlanner_(config) {
  const workerConfig = createSgdsD6fWorkerConfig_(config || {});
  return Object.freeze({
    plan(jobs) {
      const source = Array.isArray(jobs) ? jobs : [];
      return {
        jobs: source.slice(0, workerConfig.maxJobsPerRun).map(cloneD6fJson_),
        batchLimitReached: source.length > workerConfig.maxJobsPerRun,
        remainingEligibleCount: Math.max(0, source.length - workerConfig.maxJobsPerRun),
        schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_
      };
    }
  });
}

function createWorkerCheckpointManager_(repo) {
  return Object.freeze({
    latest(jobId) {
      const checkpoints = repo.listCheckpoints(jobId);
      const valid = checkpoints.filter(item => SGDS_D6F_CHECKPOINT_SEQUENCE_.includes(item.name));
      return valid.length ? valid[valid.length - 1] : null;
    },
    record(jobId, name, context, safeDetails) {
      if (!SGDS_D6F_CHECKPOINT_SEQUENCE_.includes(name)) throw d6fError_('terminal_schema_error', 'unknown checkpoint');
      const event = repo.addCheckpoint(jobId, {
        checkpointId: 'chk_' + d6fHashPrefix_([jobId, name].join('|')),
        jobId,
        name,
        correlationId: context.correlationId,
        createdAt: context.clock ? context.clock.now() : safeD6fString_(context.startedAt),
        safeDetails: sanitizeD6fEvidence_(safeDetails || {}),
        schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_
      });
      repo.appendAudit(jobId, {
        eventType: 'CHECKPOINT_RECORDED',
        idempotencyKey: 'checkpoint:' + name + ':' + context.correlationId,
        safeDetails: { checkpoint: name }
      });
      return event;
    },
    verify(job) {
      const checkpoints = repo.listCheckpoints(job.jobId);
      let previous = -1;
      for (const checkpoint of checkpoints) {
        const index = SGDS_D6F_CHECKPOINT_SEQUENCE_.indexOf(checkpoint.name);
        if (index < previous) return { status: 'invalid_checkpoint_sequence', valid: false };
        previous = index;
      }
      const latest = checkpoints.length ? checkpoints[checkpoints.length - 1].name : '';
      if (job.status === 'completed' && latest !== 'completed') return { status: 'terminal_inconsistent_state', valid: false };
      return { status: 'checkpoint_sequence_valid', valid: true, latest };
    },
    nextStage(job) {
      const latest = this.latest(job.jobId);
      const latestName = latest ? latest.name : '';
      const index = SGDS_D6F_CHECKPOINT_SEQUENCE_.indexOf(latestName);
      return SGDS_D6F_CHECKPOINT_SEQUENCE_[Math.max(0, index + 1)] || 'completed';
    }
  });
}

function createWorkerLeaseManager_(repo, configInput, clock) {
  const config = createSgdsD6fWorkerConfig_(configInput || {});
  const workerClock = clock || createFakeWorkerClock_();
  return Object.freeze({
    acquire(jobId, ownerId) {
      const now = workerClock.now();
      const existing = repo.inspectLease(jobId);
      if (existing && !existing.releasedAt && Date.parse(existing.expiresAt) > Date.parse(now) && existing.ownerId !== ownerId) {
        return { status: 'LEASE_CONFLICT_ACTIVE_OWNER', acquired: false, lease: cloneD6fJson_(existing) };
      }
      if (existing && !existing.releasedAt && existing.ownerId === ownerId && Date.parse(existing.expiresAt) > Date.parse(now)) {
        return { status: 'LEASE_REACQUIRED_SAME_OWNER', acquired: true, lease: cloneD6fJson_(existing) };
      }
      const lease = {
        leaseId: 'lease_' + d6fHashPrefix_([jobId, ownerId, now].join('|')),
        jobId,
        ownerId,
        acquiredAt: now,
        expiresAt: addD6fSeconds_(now, config.leaseDurationSeconds),
        renewedAt: now,
        releaseReason: '',
        releasedAt: '',
        schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_
      };
      repo.saveLease(jobId, lease);
      return { status: existing ? 'LEASE_RECLAIMED_EXPIRED' : 'LEASE_ACQUIRED', acquired: true, lease: cloneD6fJson_(lease) };
    },
    renew(jobId, leaseId) {
      const current = repo.inspectLease(jobId);
      if (!current || current.leaseId !== leaseId || current.releasedAt) return { status: 'LEASE_RENEW_REJECTED', renewed: false };
      current.renewedAt = workerClock.now();
      current.expiresAt = addD6fSeconds_(current.renewedAt, config.leaseDurationSeconds);
      repo.saveLease(jobId, current);
      return { status: 'LEASE_RENEWED', renewed: true, lease: cloneD6fJson_(current) };
    },
    release(jobId, leaseId, reason) {
      const current = repo.inspectLease(jobId);
      if (!current || current.leaseId !== leaseId || current.releasedAt) return { status: 'LEASE_RELEASE_REJECTED', released: false };
      current.releaseReason = safeD6fString_(reason || 'released');
      current.releasedAt = workerClock.now();
      repo.saveLease(jobId, current);
      return { status: 'LEASE_RELEASED', released: true, lease: cloneD6fJson_(current) };
    },
    inspect(jobId) {
      return cloneD6fJson_(repo.inspectLease(jobId));
    }
  });
}

function createWorkerErrorClassifier_() {
  return Object.freeze({
    classify(error) {
      const text = safeD6fString_(error && (error.code || error.message || error)).toLowerCase();
      let category = 'unknown_internal_error';
      if (/429|rate/.test(text)) category = 'retryable_rate_limit';
      else if (/timeout|408/.test(text)) category = 'retryable_timeout';
      else if (/contention|conflict|lease/.test(text)) category = 'retryable_contention';
      else if (/503|502|500|transport|temporary|transient/.test(text)) category = 'retryable_transport_error';
      else if (/permission|403/.test(text)) category = 'terminal_permission_error';
      else if (/auth|401/.test(text)) category = 'terminal_authentication_error';
      else if (/schema/.test(text)) category = 'terminal_schema_error';
      else if (/unsupported/.test(text)) category = 'terminal_unsupported_type';
      else if (/validation|invalid/.test(text)) category = 'terminal_validation_error';
      else if (/idempotency/.test(text)) category = 'idempotency_conflict';
      else if (/reconciliation/.test(text)) category = 'reconciliation_conflict';
      else if (/budget/.test(text)) category = 'runtime_budget_exhausted';
      else if (/lock_not_acquired/.test(text)) category = 'worker_lock_not_acquired';
      return {
        category,
        retryable: ['retryable_transport_error', 'retryable_rate_limit', 'retryable_timeout', 'retryable_contention'].includes(category),
        safeMessage: sanitizeD6fText_(error && (error.safeMessage || error.message || error)),
        schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_
      };
    }
  });
}

function createWorkerRetryScheduler_(configInput, clock, jitter) {
  const config = createSgdsD6fWorkerConfig_(configInput || {});
  const workerClock = clock || createFakeWorkerClock_();
  const jitterFn = typeof jitter === 'function' ? jitter : (() => 0);
  return Object.freeze({
    isEligible(job) {
      if (safeD6fString_(job.status) !== 'failed_retryable') return true;
      if (!job.nextRetryAt) return true;
      return Date.parse(job.nextRetryAt) <= Date.parse(workerClock.now());
    },
    schedule(job, classification) {
      const attemptCount = Number(job.attemptCount || 0) + 1;
      const exhausted = attemptCount >= config.maxRetriesPerJob;
      const delay = Math.min(3600, Math.pow(2, Math.max(0, attemptCount - 1)) * 60 + Number(jitterFn(attemptCount) || 0));
      return {
        attemptCount,
        maximumAttempts: config.maxRetriesPerJob,
        previousAttemptAt: workerClock.now(),
        nextRetryAt: exhausted ? '' : addD6fSeconds_(workerClock.now(), delay),
        lastErrorCode: classification.category,
        retryReason: classification.safeMessage,
        terminalAfterExhaustion: exhausted,
        schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_
      };
    }
  });
}

function createWorkerReconciliationCoordinator_() {
  return Object.freeze({
    reconcile(job, checkpoints) {
      const latestNames = (checkpoints || []).map(item => item.name);
      if (!job.gmailMessageId) return d6fReconciliation_('requires_review', ['MISSING_GMAIL_IDENTITY']);
      if (!job.attachmentIds || !job.attachmentIds.length) return d6fReconciliation_('requires_review', ['MISSING_ATTACHMENT_IDENTITY']);
      if (job.lastErrorCode === 'idempotency_conflict') return d6fReconciliation_('conflicting_source_hash', ['IDEMPOTENCY_CONFLICT']);
      if (job.status === 'completed' && latestNames.includes('completed')) return d6fReconciliation_('fully_reconciled', []);
      if (job.status === 'failed_terminal') return d6fReconciliation_('terminal_inconsistent_state', [job.lastErrorCode || 'TERMINAL_FAILURE']);
      return d6fReconciliation_('partially_reconciled_resumable', []);
    }
  });
}

function createWorkerRunSummaryBuilder_() {
  return Object.freeze({
    build(context, state) {
      const source = state || {};
      return {
        runId: context.runId,
        status: source.status || 'PASS',
        dryRun: context.dryRun,
        startedAt: context.startedAt,
        finishedAt: source.finishedAt || context.startedAt,
        stoppedReason: source.stoppedReason || 'completed_batch',
        lockStatus: source.lockStatus || 'acquired',
        discoveredCount: Number(source.discoveredCount || 0),
        queuedCount: Number(source.queuedCount || 0),
        attemptedJobCount: Number(source.attemptedJobCount || 0),
        completedCount: Number(source.completedCount || 0),
        retryableFailureCount: Number(source.retryableFailureCount || 0),
        terminalFailureCount: Number(source.terminalFailureCount || 0),
        skippedLeaseCount: Number(source.skippedLeaseCount || 0),
        skippedRetryNotDueCount: Number(source.skippedRetryNotDueCount || 0),
        noOpCount: Number(source.noOpCount || 0),
        reviewRequiredCount: Number(source.reviewRequiredCount || 0),
        remainingEligibleCount: Number(source.remainingEligibleCount || 0),
        budgetExhausted: Boolean(source.budgetExhausted),
        productionCallCount: 0,
        productionMutationCount: 0,
        quotaLimits: cloneD6fJson_(source.quotaLimits || {}),
        schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_
      };
    }
  });
}

function createSgdsCheckpointWorker_(deps) {
  const options = deps || {};
  const config = createSgdsD6fWorkerConfig_(options.config || {});
  const clock = options.clock || createFakeWorkerClock_();
  const lock = options.globalLock || createFakeWorkerLock_();
  const repo = options.repository || createFakeSgdsWorkerRepository_({ clock });
  const discovery = options.discovery || { discover: () => [] };
  const drivePlanner = options.drivePlanner || { plan: input => ({ status: 'planned', input: cloneD6fJson_(input) }) };
  const sheetsPlanner = options.sheetsPlanner || { plan: input => ({ action: 'INSERT', input: cloneD6fJson_(input) }) };
  const checkpointManager = createWorkerCheckpointManager_(repo);
  const leaseManager = createWorkerLeaseManager_(repo, config, clock);
  const retryScheduler = createWorkerRetryScheduler_(config, clock, options.jitter);
  const classifier = createWorkerErrorClassifier_();
  const reconciler = createWorkerReconciliationCoordinator_();
  const summaryBuilder = createWorkerRunSummaryBuilder_();

  async function run(input) {
    let context;
    const state = {
      status: 'PASS',
      stoppedReason: 'completed_batch',
      lockStatus: 'not_attempted',
      discoveredCount: 0,
      queuedCount: 0,
      attemptedJobCount: 0,
      completedCount: 0,
      retryableFailureCount: 0,
      terminalFailureCount: 0,
      skippedLeaseCount: 0,
      skippedRetryNotDueCount: 0,
      noOpCount: 0,
      reviewRequiredCount: 0,
      remainingEligibleCount: 0,
      budgetExhausted: false,
      quotaLimits: createSgdsD6fQuotaSnapshot_(config)
    };
    try {
      context = createSgdsWorkerRunContext_({ ...(input || {}), clock }, config);
    } catch (error) {
      const fallback = { runId: 'run_configuration_invalid', dryRun: true, startedAt: clock.now(), schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_ };
      return summaryBuilder.build(fallback, { ...state, status: 'BLOCKED', stoppedReason: 'configuration_invalid', finishedAt: clock.now() });
    }
    const budget = createWorkerRuntimeBudget_(context, clock);
    const lockResult = lock.acquire({ runId: context.runId, timeoutMillis: 1000 });
    state.lockStatus = lockResult.acquired ? 'acquired' : 'lock_not_acquired';
    if (!lockResult.acquired) {
      return summaryBuilder.build(context, { ...state, status: 'SKIPPED', stoppedReason: 'lock_not_acquired', finishedAt: clock.now() });
    }
    try {
      const discovered = (await discovery.discover({ context, config })) || [];
      state.discoveredCount = Math.min(discovered.length, config.maxMessagesPerRun);
      const jobs = repo.createOrRecoverJobs(discovered.slice(0, config.maxMessagesPerRun), context);
      state.queuedCount = jobs.filter(job => job.status === 'queued' || job.status === 'discovered').length;
      const allKnownJobs = repo.listEligibleJobs(context);
      state.noOpCount += allKnownJobs.filter(job => job.status === 'completed').length;
      const eligible = allKnownJobs.filter(job => !SGDS_D6F_TERMINAL_STATES_.includes(job.status));
      const batch = createWorkerBatchPlanner_(config).plan(eligible);
      state.remainingEligibleCount = batch.remainingEligibleCount;
      for (const job of batch.jobs) {
        if (!budget.canStartStage('lease_acquired')) {
          state.budgetExhausted = true;
          state.stoppedReason = 'soft_deadline_reached';
          break;
        }
        if (state.attemptedJobCount >= config.maxJobsPerRun) {
          state.stoppedReason = 'batch_limit_reached';
          break;
        }
        if (state.terminalFailureCount + state.retryableFailureCount >= config.maximumConsecutiveFailures) {
          state.stoppedReason = 'consecutive_failure_limit_reached';
          break;
        }
        const latest = repo.getJob(job.jobId);
        if (latest && latest.status === 'completed') {
          state.noOpCount += 1;
          continue;
        }
        if (!retryScheduler.isEligible(latest || job)) {
          state.skippedRetryNotDueCount += 1;
          continue;
        }
        state.attemptedJobCount += 1;
        const processed = await processOneJob_(latest || job, {
          context,
          config,
          clock,
          budget,
          repo,
          checkpointManager,
          leaseManager,
          retryScheduler,
          classifier,
          reconciler,
          drivePlanner,
          sheetsPlanner,
          failureInjection: options.failureInjection || {}
        });
        if (processed.status === 'completed') state.completedCount += 1;
        if (processed.status === 'failed_retryable') state.retryableFailureCount += 1;
        if (processed.status === 'failed_terminal') state.terminalFailureCount += 1;
        if (processed.status === 'skipped_lease') state.skippedLeaseCount += 1;
        if (processed.reviewRequired) state.reviewRequiredCount += 1;
      }
      if (batch.batchLimitReached && state.stoppedReason === 'completed_batch') state.stoppedReason = 'batch_limit_reached';
      return summaryBuilder.build(context, { ...state, finishedAt: clock.now() });
    } catch (error) {
      return summaryBuilder.build(context, { ...state, status: 'FAILED', stoppedReason: 'controlled_failure', finishedAt: clock.now() });
    } finally {
      lock.release({ runId: context.runId });
    }
  }

  return Object.freeze({
    run,
    repository: repo,
    config,
    components: SGDS_D6F_WORKER_COMPONENTS_
  });
}

async function processOneJob_(job, deps) {
  const d = deps || {};
  const lease = d.leaseManager.acquire(job.jobId, d.context.workerInstanceId);
  if (!lease.acquired) return { status: 'skipped_lease' };
  let activeLeaseId = lease.lease.leaseId;
  try {
    d.checkpointManager.record(job.jobId, 'lease_acquired', d.context, { leaseIdHashPrefix: d6fHashPrefix_(activeLeaseId) });
    const compatible = d.checkpointManager.verify(job);
    if (!compatible.valid) throw d6fError_('terminal_schema_error', compatible.status);
    let current = d.repo.getJob(job.jobId);
    if (current.status === 'discovered') current = transitionD6fJob_(d.repo, current, 'queued', d.context, {});
    if (current.status === 'failed_retryable') current = transitionD6fJob_(d.repo, current, 'queued', d.context, { retryResumedAt: d.clock.now() });
    if (current.status === 'queued') current = transitionD6fJob_(d.repo, current, 'processing', d.context, { attemptCount: Number(current.attemptCount || 0) + 1 });
    const stages = [
      ['message_normalized', 'processing'],
      ['attachment_planned', 'processing'],
      ['attachment_saved', 'attachment_saved'],
      ['business_data_normalized', 'attachment_saved'],
      ['sheet_upsert_planned', 'data_extracted'],
      ['sheet_written', 'sheet_written'],
      ['reconciliation_recorded', 'sheet_written'],
      ['completed', 'completed']
    ];
    for (const [checkpoint, targetState] of stages) {
      if (!d.budget.canStartStage(checkpoint)) throw d6fError_('runtime_budget_exhausted', checkpoint);
      if (d.failureInjection[job.jobId] === checkpoint || d.failureInjection.stage === checkpoint) {
        throw d6fError_(d.failureInjection.code || 'retryable_transport_error', checkpoint);
      }
      if (checkpoint === 'attachment_planned') d.drivePlanner.plan(job);
      if (checkpoint === 'sheet_upsert_planned') d.sheetsPlanner.plan(job);
      d.checkpointManager.record(job.jobId, checkpoint, d.context, { stage: checkpoint, confirmation: d.config.simulatedExecution ? 'simulated' : 'planned' });
      current = d.repo.getJob(job.jobId);
      if (checkpoint === 'completed' && !d.config.simulatedExecution) {
        current = transitionD6fJob_(d.repo, current, 'failed_terminal', d.context, { lastErrorCode: 'dry_run_planned_only' });
        return { status: 'failed_terminal', reviewRequired: true };
      }
      if (targetState !== current.status && isD6fTransitionAllowed_(current.status, targetState)) {
        current = transitionD6fJob_(d.repo, current, targetState, d.context, {});
      }
    }
    const finalJob = d.repo.getJob(job.jobId);
    const reconciliation = d.reconciler.reconcile(finalJob, d.repo.listCheckpoints(job.jobId));
    d.repo.saveReconciliation(job.jobId, reconciliation);
    d.leaseManager.release(job.jobId, activeLeaseId, 'success');
    return { status: finalJob.status, reviewRequired: reconciliation.state !== 'fully_reconciled' };
  } catch (error) {
    const classification = d.classifier.classify(error);
    const current = d.repo.getJob(job.jobId);
    if (classification.retryable) {
      const retry = d.retryScheduler.schedule(current, classification);
      const nextState = retry.terminalAfterExhaustion ? 'failed_terminal' : 'failed_retryable';
      transitionD6fJob_(d.repo, current, nextState, d.context, {
        attemptCount: retry.attemptCount,
        nextRetryAt: retry.nextRetryAt,
        retryPolicy: retry,
        lastErrorCode: retry.lastErrorCode,
        lastErrorMessage: retry.retryReason
      });
      d.leaseManager.release(job.jobId, activeLeaseId, 'controlled_failure');
      return { status: nextState, reviewRequired: nextState === 'failed_terminal' };
    }
    transitionD6fJob_(d.repo, current, 'failed_terminal', d.context, {
      lastErrorCode: classification.category,
      lastErrorMessage: classification.safeMessage
    });
    d.leaseManager.release(job.jobId, activeLeaseId, 'terminal_failure');
    return { status: 'failed_terminal', reviewRequired: true };
  }
}

function transitionD6fJob_(repo, job, toState, context, patch) {
  const from = safeD6fString_(job.status);
  if (!isD6fTransitionAllowed_(from, toState)) {
    const evidence = { resultCode: 'JOB_TRANSITION_REJECTED', priorState: from, nextState: toState, schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_ };
    repo.appendAudit(job.jobId, { eventType: 'JOB_TRANSITION_REJECTED', idempotencyKey: 'reject:' + from + ':' + toState, safeDetails: evidence });
    throw d6fError_('terminal_schema_error', 'invalid transition ' + from + ' to ' + toState);
  }
  const next = {
    ...cloneD6fJson_(job),
    ...(patch || {}),
    status: toState,
    currentStep: toState,
    updatedAt: context.clock ? context.clock.now() : context.startedAt,
    completedAt: toState === 'completed' ? (context.clock ? context.clock.now() : context.startedAt) : (job.completedAt || ''),
    schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_
  };
  repo.saveJob(next);
  repo.appendAudit(job.jobId, {
    eventType: 'JOB_TRANSITION_ACCEPTED',
    idempotencyKey: 'transition:' + from + ':' + toState + ':' + context.correlationId,
    safeDetails: { priorState: from, nextState: toState, currentStep: toState }
  });
  return cloneD6fJson_(next);
}

function isD6fTransitionAllowed_(from, to) {
  return SGDS_D6F_JOB_TRANSITIONS_[safeD6fString_(from)] && SGDS_D6F_JOB_TRANSITIONS_[safeD6fString_(from)].includes(safeD6fString_(to));
}

function createFakeSgdsWorkerRepository_(options) {
  const clock = (options && options.clock) || createFakeWorkerClock_();
  const state = {
    jobs: {},
    checkpoints: {},
    audits: {},
    leases: {},
    reconciliations: {}
  };
  function normalizeSeed(seed, context) {
    const source = seed || {};
    const jobId = safeD6fString_(source.jobId) || 'job_' + d6fHashPrefix_([source.gmailMessageId, source.threadId, (source.attachmentIds || []).join(',')].join('|'));
    return {
      jobId,
      gmailMessageId: safeD6fString_(source.gmailMessageId || 'msg_' + d6fHashPrefix_(jobId)),
      threadId: safeD6fString_(source.threadId || 'thread_' + d6fHashPrefix_(jobId)),
      status: safeD6fString_(source.status || 'discovered'),
      currentStep: safeD6fString_(source.currentStep || source.status || 'discovered'),
      attemptCount: Number(source.attemptCount || 0),
      nextRetryAt: safeD6fString_(source.nextRetryAt || ''),
      leaseOwner: safeD6fString_(source.leaseOwner || ''),
      leaseExpiresAt: safeD6fString_(source.leaseExpiresAt || ''),
      attachmentIds: Array.isArray(source.attachmentIds) ? source.attachmentIds.map(safeD6fString_) : ['att_' + d6fHashPrefix_(jobId)],
      driveFileIds: Array.isArray(source.driveFileIds) ? source.driveFileIds.map(safeD6fString_) : [],
      sheetRecordKeys: Array.isArray(source.sheetRecordKeys) ? source.sheetRecordKeys.map(safeD6fString_) : [],
      idempotencyKey: safeD6fString_(source.idempotencyKey || d6fHashPrefix_(jobId)),
      lastErrorCode: safeD6fString_(source.lastErrorCode || ''),
      lastErrorMessage: sanitizeD6fText_(source.lastErrorMessage || ''),
      createdAt: safeD6fString_(source.createdAt || (context && context.startedAt) || clock.now()),
      updatedAt: safeD6fString_(source.updatedAt || (context && context.startedAt) || clock.now()),
      completedAt: safeD6fString_(source.completedAt || ''),
      schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_
    };
  }
  const api = {
    createOrRecoverJobs(candidates, context) {
      return (Array.isArray(candidates) ? candidates : []).map(seed => {
        const job = normalizeSeed(seed, context);
        if (!state.jobs[job.jobId]) {
          state.jobs[job.jobId] = cloneD6fJson_(job);
          api.appendAudit(job.jobId, { eventType: 'JOB_CREATED_OR_RECOVERED', idempotencyKey: 'create:' + job.jobId, safeDetails: { status: job.status } });
          api.addCheckpoint(job.jobId, { checkpointId: 'chk_discovery_' + d6fHashPrefix_(job.jobId), name: 'discovery_recorded', jobId: job.jobId, correlationId: context.correlationId, createdAt: context.startedAt, schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_ });
        }
        return cloneD6fJson_(state.jobs[job.jobId]);
      });
    },
    listEligibleJobs() {
      return Object.values(state.jobs).map(cloneD6fJson_);
    },
    getJob(jobId) {
      return cloneD6fJson_(state.jobs[safeD6fString_(jobId)] || null);
    },
    saveJob(job) {
      state.jobs[job.jobId] = cloneD6fJson_(job);
      return cloneD6fJson_(state.jobs[job.jobId]);
    },
    addCheckpoint(jobId, checkpoint) {
      const list = state.checkpoints[jobId] || [];
      const id = safeD6fString_(checkpoint.checkpointId || checkpoint.name);
      const existing = list.find(item => item.checkpointId === id);
      if (existing) return cloneD6fJson_(existing);
      const next = { ...cloneD6fJson_(checkpoint), checkpointId: id };
      list.push(next);
      state.checkpoints[jobId] = list;
      return cloneD6fJson_(next);
    },
    listCheckpoints(jobId) {
      return cloneD6fJson_(state.checkpoints[jobId] || []);
    },
    appendAudit(jobId, event) {
      const list = state.audits[jobId] || [];
      const key = safeD6fString_(event.idempotencyKey || event.eventType);
      const existing = list.find(item => item.idempotencyKey === key);
      if (existing) return cloneD6fJson_(existing);
      const next = {
        eventId: 'evt_' + d6fHashPrefix_([jobId, key].join('|')),
        jobId,
        sequence: list.length + 1,
        eventType: safeD6fString_(event.eventType || 'EVENT'),
        occurredAt: clock.now(),
        idempotencyKey: key,
        safeDetails: sanitizeD6fEvidence_(event.safeDetails || {}),
        schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_
      };
      list.push(next);
      state.audits[jobId] = list;
      return cloneD6fJson_(next);
    },
    listAudit(jobId) {
      return cloneD6fJson_(state.audits[jobId] || []);
    },
    saveLease(jobId, lease) {
      state.leases[jobId] = cloneD6fJson_(lease);
      return cloneD6fJson_(state.leases[jobId]);
    },
    inspectLease(jobId) {
      return cloneD6fJson_(state.leases[jobId] || null);
    },
    saveReconciliation(jobId, reconciliation) {
      state.reconciliations[jobId] = cloneD6fJson_(reconciliation);
      return cloneD6fJson_(reconciliation);
    },
    getReconciliation(jobId) {
      return cloneD6fJson_(state.reconciliations[jobId] || null);
    },
    state
  };
  return Object.freeze(api);
}

function createFakeWorkerClock_(start) {
  let current = Date.parse(start || '2026-07-18T00:00:00.000Z');
  return Object.freeze({
    now() {
      return new Date(current).toISOString();
    },
    advanceSeconds(seconds) {
      current += Number(seconds || 0) * 1000;
      return new Date(current).toISOString();
    }
  });
}

function createFakeWorkerDelay_() {
  const calls = [];
  return Object.freeze({
    calls,
    wait(milliseconds) {
      calls.push(Number(milliseconds || 0));
      return { waited: true, milliseconds: Number(milliseconds || 0) };
    }
  });
}

function createFakeWorkerLock_(options) {
  let locked = false;
  const calls = [];
  return Object.freeze({
    calls,
    acquire(request) {
      calls.push({ method: 'acquire', request: cloneD6fJson_(request || {}) });
      if ((options && options.failAcquire) || locked) return { acquired: false, status: 'lock_not_acquired' };
      locked = true;
      return { acquired: true, status: 'acquired' };
    },
    release(request) {
      calls.push({ method: 'release', request: cloneD6fJson_(request || {}) });
      if (options && options.failRelease) return { released: false, status: 'release_failed_recorded' };
      locked = false;
      return { released: true, status: 'released' };
    },
    isLocked() {
      return locked;
    }
  });
}

function runSgdsWorkerDryRun(config) {
  const worker = createSgdsCheckpointWorker_({ config: createSgdsD6fWorkerConfig_(config || {}) });
  return worker.run({ invocationSource: 'manual_apps_script' });
}

function inspectSgdsWorkerConfiguration(config) {
  const safe = createSgdsD6fWorkerConfig_(config || {});
  return {
    status: 'CONFIGURATION_VALID',
    defaultDryRun: safe.dryRun,
    productionModeDefault: false,
    productionCallCount: 0,
    productionMutationCount: 0,
    quotaLimits: createSgdsD6fQuotaSnapshot_(safe),
    schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_
  };
}

function createSgdsD6fQuotaSnapshot_(config) {
  return {
    maxMessagesPerRun: Number(config.maxMessagesPerRun),
    maxJobsPerRun: Number(config.maxJobsPerRun),
    maxAttachmentsPerRun: Number(config.maxAttachmentsPerRun),
    maxRetryActionsPerRun: Number(config.maxRetryActionsPerRun),
    softRuntimeDeadlineSeconds: Number(config.softRuntimeDeadlineSeconds),
    leaseDurationSeconds: Number(config.leaseDurationSeconds),
    maximumConsecutiveFailures: Number(config.maximumConsecutiveFailures),
    maximumAttachmentBytes: Number(config.maximumAttachmentBytes),
    maximumAuditEventsPerJob: Number(config.maximumAuditEventsPerJob),
    maximumFirestoreOperationsPerRun: Number(config.maximumFirestoreOperationsPerRun),
    maximumVirtualDriveWritesPerRun: Number(config.maximumVirtualDriveWritesPerRun),
    maximumVirtualSheetsWritesPerRun: Number(config.maximumVirtualSheetsWritesPerRun),
    schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_
  };
}

function d6fReconciliation_(state, findingCodes) {
  return {
    state: SGDS_D6F_RECONCILIATION_STATES_.includes(state) ? state : 'requires_review',
    findingCodes: (Array.isArray(findingCodes) ? findingCodes : []).map(safeD6fString_),
    productionMutation: 'NONE',
    schemaVersion: SGDS_D6F_D6G_SCHEMA_VERSION_
  };
}

function d6fError_(code, message) {
  const error = new Error(safeD6fString_(code) + ':' + sanitizeD6fText_(message || code));
  error.code = safeD6fString_(code);
  error.safeMessage = sanitizeD6fText_(message || code);
  return error;
}

function sanitizeD6fEvidence_(value) {
  if (Array.isArray(value)) return value.map(sanitizeD6fEvidence_);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(key => {
      out[key] = sanitizeD6fEvidence_(value[key]);
    });
    return out;
  }
  return sanitizeD6fText_(value);
}

function sanitizeD6fText_(value) {
  const text = safeD6fString_(value);
  if (!text) return '';
  if (/@/.test(text)) return 'REDACTED_EMAIL';
  if (/\b\d{10,14}\b/.test(text)) return 'REDACTED_NUMERIC_IDENTIFIER';
  const privateKeyBlockMarker = ['BEGIN', 'PRIVATE', 'KEY'].join(' ');
  const secretPattern = new RegExp(['authorization', 'bearer', 'oauth', 'token', 'credential', 'cookie', 'ya29', 'private[_ -]?key', privateKeyBlockMarker].join('|'), 'i');
  if (secretPattern.test(text)) return 'REDACTED_SECRET';
  if (text.length > 180) return 'REDACTED_LONG_TEXT_' + d6fHashPrefix_(text);
  return text;
}

function addD6fSeconds_(iso, seconds) {
  return new Date(Date.parse(iso) + Number(seconds || 0) * 1000).toISOString();
}

function d6fHashPrefix_(value) {
  const text = safeD6fString_(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

function safeD6fString_(value) {
  return value == null ? '' : String(value);
}

function cloneD6fJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
